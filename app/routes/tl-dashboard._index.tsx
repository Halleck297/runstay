// app/routes/tl-dashboard.tsx - Team Leader Dashboard
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { useLoaderData, useActionData, Form, Link, useLocation, useNavigate } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { useEffect, useState } from "react";
import { sendTemplatedEmail } from "~/lib/email/service.server";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { buildTeamLeaderNavItems } from "~/components/panelNav";
import { useI18n } from "~/hooks/useI18n";
import { getTlEventNotificationSummary } from "~/lib/tl-event-notifications.server";
import { isTeamLeader } from "~/lib/user-access";

const MAX_BATCH_INVITES = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[“”‘’\"'`]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

export const meta: MetaFunction = () => {
  return [{ title: "Team Leader Dashboard - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const url = new URL(request.url);
  const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  const reservedPerPageOptions = [5, 10, 20, 50];
  const inviteSentRaw = Number(url.searchParams.get("inviteSent") || "0");
  const inviteSent = Number.isFinite(inviteSentRaw) && inviteSentRaw > 0 ? Math.floor(inviteSentRaw) : 0;
  const parsedReservedPerPage = Number(url.searchParams.get("reservedPerPage") || "5");
  const reservedPerPage = reservedPerPageOptions.includes(parsedReservedPerPage) ? parsedReservedPerPage : 5;
  const parsedReservedPage = Number(url.searchParams.get("reservedPage") || "1");
  const requestedReservedPage = Number.isFinite(parsedReservedPage) && parsedReservedPage > 0
    ? Math.floor(parsedReservedPage)
    : 1;
  const reservedView = url.searchParams.get("reservedView") === "linked" ? "linked" : "not_joined";
  const reservedStatus = reservedView === "linked" ? "accepted" : "pending";

  if (!isTeamLeader(user)) {
    throw redirect("/to-panel");
  }
  const eventNotificationSummary = await getTlEventNotificationSummary((user as any).id);

  // Fetch referrals with user details
  const { data: referrals } = await supabaseAdmin
    .from("referrals")
    .select("id, referral_code_used, status, created_at, referred_user_id")
    .eq("team_leader_id", (user as any).id)
    .neq("referred_user_id", (user as any).id)
    .order("created_at", { ascending: false });

  // Fetch referred users' profiles
  const referralIds = (referrals || []).map((r: any) => r.referred_user_id);
  let referredUsers: Record<string, any> = {};
  if (referralIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, user_type, is_verified, created_at, avatar_url")
      .in("id", referralIds);

    if (profiles) {
      for (const p of profiles as any[]) {
        referredUsers[p.id] = p;
      }
    }
  }

  const { count: reservedNotJoinedCount } = await (supabaseAdmin.from("referral_invites") as any)
    .select("id", { count: "exact", head: true })
    .eq("team_leader_id", (user as any).id)
    .eq("status", "pending");

  const { count: reservedLinkedCount } = await (supabaseAdmin.from("referral_invites") as any)
    .select("id", { count: "exact", head: true })
    .eq("team_leader_id", (user as any).id)
    .eq("status", "accepted");

  const { count: reservedTotalCount } = await (supabaseAdmin.from("referral_invites") as any)
    .select("id", { count: "exact", head: true })
    .eq("team_leader_id", (user as any).id)
    .eq("status", reservedStatus);

  const safeReservedTotalCount = reservedTotalCount || 0;
  const reservedTotalPages = Math.max(1, Math.ceil(safeReservedTotalCount / reservedPerPage));
  const reservedPage = Math.min(requestedReservedPage, reservedTotalPages);
  const reservedFrom = (reservedPage - 1) * reservedPerPage;
  const reservedTo = reservedFrom + reservedPerPage - 1;

  const { data: reservedEmails } = await (supabaseAdmin.from("referral_invites") as any)
    .select("id, email, status, created_at, claimed_at")
    .eq("team_leader_id", (user as any).id)
    .eq("status", reservedStatus)
    .order("created_at", { ascending: false })
    .range(reservedFrom, reservedTo);

  // Stats
  const totalReferrals = referrals?.length || 0;
  const activeReferrals = referrals?.filter((r: any) => r.status === "active").length || 0;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const newInLast30Days = (referrals || []).filter((r: any) => new Date(r.created_at) >= thirtyDaysAgo).length;

  let teamListings = 0;
  let teamSaved = 0;
  let teamConversationsStarted = 0;

  if (referralIds.length > 0) {
    const [{ count: listingsCount }, { count: savedCount }] = await Promise.all([
      (supabaseAdmin.from("listings") as any)
        .select("id", { count: "exact", head: true })
        .in("author_id", referralIds),
      (supabaseAdmin.from("saved_listings") as any)
        .select("id", { count: "exact", head: true })
        .in("user_id", referralIds),
    ]);

    teamListings = listingsCount || 0;
    teamSaved = savedCount || 0;

    const [convAsP1, convAsP2] = await Promise.all([
      (supabaseAdmin.from("conversations") as any).select("id").in("participant_1", referralIds),
      (supabaseAdmin.from("conversations") as any).select("id").in("participant_2", referralIds),
    ]);

    const teamConversationIds = Array.from(
      new Set([...(convAsP1.data || []), ...(convAsP2.data || [])].map((c: any) => c.id))
    );

    if (teamConversationIds.length > 0) {
      const { data: firstUserMessages } = await (supabaseAdmin.from("messages") as any)
        .select("conversation_id, sender_id, created_at")
        .in("conversation_id", teamConversationIds)
        .eq("message_type", "user")
        .order("created_at", { ascending: true });

      const firstSenderByConversation = new Map<string, string>();
      for (const msg of firstUserMessages || []) {
        if (!firstSenderByConversation.has(msg.conversation_id)) {
          firstSenderByConversation.set(msg.conversation_id, msg.sender_id);
        }
      }

      const referralIdSet = new Set(referralIds);
      teamConversationsStarted = Array.from(firstSenderByConversation.values()).filter((senderId) =>
        referralIdSet.has(senderId)
      ).length;
    }
  }

  const { data: recentInvites } = await (supabaseAdmin.from("referral_invites") as any)
    .select("id, email, status, created_at, claimed_at, updated_at")
    .eq("team_leader_id", (user as any).id)
    .order("updated_at", { ascending: false })
    .limit(12);

  return {
    user,
    appUrl,
    referrals: referrals || [],
    referredUsers,
    reservedEmails: reservedEmails || [],
    reservedPagination: {
      view: reservedView,
      perPage: reservedPerPage,
      page: reservedPage,
      totalCount: safeReservedTotalCount,
      totalPages: reservedTotalPages,
      perPageOptions: reservedPerPageOptions,
    },
    reservedCounts: {
      notJoined: reservedNotJoinedCount || 0,
      linked: reservedLinkedCount || 0,
    },
    inviteResult: {
      sent: inviteSent,
    },
    stats: {
      totalReferrals,
      activeReferrals,
      newInLast30Days,
      teamListings,
      teamSaved,
      teamConversationsStarted,
    },
    recentInvites: recentInvites || [],
    eventUnreadCount: eventNotificationSummary.totalUnread,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);

  if (!isTeamLeader(user)) {
    return data({ errorKey: "not_team_leader" as const }, { status: 403 });
  }

  const formData = await request.formData();
  const actionType = formData.get("_action") as string;

  switch (actionType) {
    case "updateCode": {
      const newCode = (formData.get("referralCode") as string || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

      if (newCode.length < 3 || newCode.length > 20) {
        return data({ errorKey: "code_length_invalid" as const }, { status: 400 });
      }

      // Check uniqueness
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("referral_code", newCode)
        .neq("id", (user as any).id)
        .single();

      if (existing) {
        return data({ errorKey: "code_taken" as const }, { status: 400 });
      }

      await (supabaseAdmin.from("profiles") as any)
        .update({ referral_code: newCode })
        .eq("id", (user as any).id);

      return data({ success: true, messageKey: "tl_dashboard.success.code_updated" as const });
    }

    case "updateWelcome": {
      const welcomeMessage = (formData.get("welcomeMessage") as string || "").trim();

      if (welcomeMessage.length > 500) {
        return data({ errorKey: "welcome_too_long" as const }, { status: 400 });
      }

      await (supabaseAdmin.from("profiles") as any)
        .update({ tl_welcome_message: welcomeMessage || null })
        .eq("id", (user as any).id);

      return data({ success: true, messageKey: "tl_dashboard.success.welcome_updated" as const });
    }

    case "sendInvites": {
      const rawEmails = Array.from(formData.entries())
        .filter(([key]) => key.startsWith("inviteEmail"))
        .map(([, value]) => normalizeEmail(String(value || "")))
        .filter(Boolean);

      const emails = Array.from(new Set(rawEmails));

      if (emails.length === 0) {
        return data({ errorKey: "add_one_email" as const }, { status: 400 });
      }

      if (emails.length > MAX_BATCH_INVITES) {
        return data({ error: `You can send up to ${MAX_BATCH_INVITES} invitations at once.` }, { status: 400 });
      }

      const invalidEmails = emails.filter((email) => !EMAIL_PATTERN.test(email));
      if (invalidEmails.length > 0) {
        return data({ error: `Invalid email format: ${invalidEmails.join(", ")}` }, { status: 400 });
      }

      if (!(user as any).referral_code) {
        return data({ errorKey: "missing_referral_code" as const }, { status: 400 });
      }

      const now = new Date().toISOString();
      const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
      const referralLink = `${appUrl}/join/${(user as any).referral_code}`;
      const currentUserEmail = normalizeEmail(String((user as any).email || ""));

      const { data: existingInvites } = await (supabaseAdmin.from("referral_invites") as any)
        .select("id, email, team_leader_id, status")
        .in("email", emails);

      const invitesByEmail = new Map<string, any>();
      for (const invite of (existingInvites || [])) {
        invitesByEmail.set(normalizeEmail(invite.email), invite);
      }

      const { data: matchedProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name")
        .in("email", emails);

      const profilesByEmail = new Map<string, any>();
      for (const profile of (matchedProfiles || [])) {
        profilesByEmail.set(normalizeEmail(profile.email), profile);
      }

      const profileIds = (matchedProfiles || []).map((p: any) => p.id);
      const referralsByUserId = new Map<string, any>();
      if (profileIds.length > 0) {
        const { data: existingReferrals } = await supabaseAdmin
          .from("referrals")
          .select("id, referred_user_id, team_leader_id")
          .in("referred_user_id", profileIds);

        for (const referral of (existingReferrals || [])) {
          referralsByUserId.set(referral.referred_user_id, referral);
        }
      }

      let sentEmails = 0;
      let autoLinked = 0;
      const skipped: string[] = [];
      const warnings: string[] = [];

      for (const email of emails) {
        if (email === currentUserEmail) {
          skipped.push(`${email} (you cannot invite your own account)`);
          continue;
        }

        const invite = invitesByEmail.get(email);
        const existingProfile = profilesByEmail.get(email);
        const existingReferral = existingProfile ? referralsByUserId.get(existingProfile.id) : null;

        if (invite && invite.team_leader_id !== (user as any).id) {
          skipped.push(`${email} (already reserved by another TL)`);
          continue;
        }

        if (existingReferral && existingReferral.team_leader_id !== (user as any).id) {
          skipped.push(`${email} (already linked to another TL)`);
          continue;
        }

        if (!invite) {
          const { error: insertInviteError } = await (supabaseAdmin.from("referral_invites") as any).insert({
            team_leader_id: (user as any).id,
            email,
            status: "pending",
            created_at: now,
            updated_at: now,
          });

          if (insertInviteError) {
            skipped.push(`${email} (reserve failed: ${insertInviteError.message})`);
            continue;
          }
        } else {
          await (supabaseAdmin.from("referral_invites") as any)
            .update({ updated_at: now })
            .eq("id", invite.id);
        }

        if (existingProfile && !existingReferral) {
          const { error: insertReferralError } = await (supabaseAdmin.from("referrals") as any).insert({
            team_leader_id: (user as any).id,
            referred_user_id: existingProfile.id,
            referral_code_used: (user as any).referral_code || "EMAIL_INVITE",
            status: "active",
          });

          if (insertReferralError) {
            warnings.push(`${email} (could not auto-link existing account: ${insertReferralError.message})`);
          } else {
            autoLinked += 1;
            await (supabaseAdmin.from("referral_invites") as any)
              .update({
                status: "accepted",
                claimed_by: existingProfile.id,
                claimed_at: now,
                updated_at: now,
              })
              .eq("team_leader_id", (user as any).id)
              .eq("email", email);

            await (supabaseAdmin.from("notifications") as any).insert({
              user_id: (user as any).id,
              type: "referral_signup",
              title: "Email invite matched",
              message: `${existingProfile.full_name || existingProfile.email} was linked to your team from an invited email.`,
              data: { referred_user_id: existingProfile.id, source: "email_invite" },
            });
          }

          continue;
        }

        const sendResult = await sendTemplatedEmail({
          to: email,
          templateId: "referral_invite",
          locale: (user as any).preferred_language || null,
          payload: {
            inviterName: (user as any).full_name || "Your Team Leader",
            referralLink,
            welcomeMessage: (user as any).tl_welcome_message,
          },
        });

        if (!sendResult.ok) {
          warnings.push(`${email} (${sendResult.error})`);
          continue;
        }

        sentEmails += 1;
      }

      if (sentEmails === 0 && autoLinked === 0) {
        const details = [
          skipped.length > 0 ? `Skipped: ${skipped.join("; ")}` : null,
          warnings.length > 0 ? `Warnings: ${warnings.join("; ")}` : null,
        ].filter(Boolean).join(" ");
        return data({ error: details || "No invitations were sent." }, { status: 400 });
      }

      const redirectUrl = new URL(request.url);
      redirectUrl.searchParams.set("inviteSent", String(sentEmails));
      return redirect(`${redirectUrl.pathname}${redirectUrl.search}`);
    }

    case "resendInvite": {
      const inviteId = String(formData.get("inviteId") || "").trim();
      if (!inviteId) {
        return data({ errorKey: "missing_invite_id" as const }, { status: 400 });
      }

      if (!(user as any).referral_code) {
        return data({ errorKey: "missing_referral_code" as const }, { status: 400 });
      }

      const { data: invite } = await (supabaseAdmin.from("referral_invites") as any)
        .select("id, email, status, team_leader_id")
        .eq("id", inviteId)
        .eq("team_leader_id", (user as any).id)
        .maybeSingle();

      if (!invite) {
        return data({ errorKey: "invite_not_found" as const }, { status: 404 });
      }

      if (invite.status === "accepted") {
        return data({ errorKey: "invite_already_linked" as const }, { status: 400 });
      }

      const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
      const referralLink = `${appUrl}/join/${(user as any).referral_code}`;

      const sendResult = await sendTemplatedEmail({
        to: invite.email,
        templateId: "referral_invite",
        locale: (user as any).preferred_language || null,
        payload: {
          inviterName: (user as any).full_name || "Your Team Leader",
          referralLink,
          welcomeMessage: (user as any).tl_welcome_message,
        },
      });

      if (!sendResult.ok) {
        return data({ error: `Could not resend invitation: ${sendResult.error}` }, { status: 500 });
      }

      await (supabaseAdmin.from("referral_invites") as any)
        .update({ updated_at: new Date().toISOString() })
        .eq("id", invite.id);

      return data({ success: true, message: `Invitation resent to ${invite.email}.` });
    }

    default:
      return data({ errorKey: "unknown_action" as const }, { status: 400 });
  }
}

export default function TLDashboard() {
  const { t } = useI18n();
  const {
    user,
    appUrl,
    referrals,
    referredUsers,
    reservedEmails,
    reservedPagination,
    reservedCounts,
    inviteResult,
    stats,
    recentInvites,
    eventUnreadCount,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | { error?: string; success?: boolean; message?: string; errorKey?: never; messageKey?: never }
    | { errorKey?: string; error?: never; success?: boolean; message?: never; messageKey?: never }
    | { success?: boolean; messageKey?: string; message?: never; error?: never; errorKey?: never }
    | undefined;
  const location = useLocation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [inviteFields, setInviteFields] = useState(1);
  const [inviteSuccessCount, setInviteSuccessCount] = useState<number | null>(null);

  const referralLink = `${appUrl}/join/${(user as any).referral_code}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const timelineItems = [
    ...((recentInvites || []).map((invite: any) => ({
      id: `invite-${invite.id}`,
      type: invite.status === "accepted" ? "accepted" : "sent",
      title:
        invite.status === "accepted"
          ? `Invite accepted: ${invite.email}`
          : `Invite sent: ${invite.email}`,
      at: invite.claimed_at || invite.updated_at || invite.created_at,
    })) || []),
    ...((referrals || []).map((ref: any) => {
      const refUser = referredUsers[ref.referred_user_id];
      return {
        id: `referral-${ref.id}`,
        type: "joined",
        title: `Referral joined: ${refUser?.full_name || refUser?.email || "Runner"}`,
        at: ref.created_at,
      };
    }) || []),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 10);
  const reservedStatusLabel: Record<string, string> = {
    pending: t("tl_dashboard.reserved"),
    accepted: t("tl_dashboard.linked"),
  };
  const actionError =
    actionData?.errorKey ? t(`tl_dashboard.error.${actionData.errorKey}` as any) : actionData?.error;
  const actionMessage =
    actionData?.messageKey ? t(actionData.messageKey as any) : actionData?.message;
  const reservedBuildUrl = (updates: Record<string, string | number>) => {
    const params = new URLSearchParams(location.search);
    for (const [key, value] of Object.entries(updates)) {
      params.set(key, String(value));
    }
    const query = params.toString();
    return query ? `${location.pathname}?${query}` : location.pathname;
  };

  useEffect(() => {
    if (!inviteResult?.sent) return;

    setInviteSuccessCount(inviteResult.sent);
    setInviteFields(1);

    const params = new URLSearchParams(location.search);
    params.delete("inviteSent");
    const cleanQuery = params.toString();
    navigate(cleanQuery ? `${location.pathname}?${cleanQuery}` : location.pathname, { replace: true });
  }, [inviteResult?.sent, location.pathname, location.search, navigate]);

  const topContent = (
    <>
      <div className="mb-3 rounded-3xl border border-brand-200/70 bg-gradient-to-r from-brand-50 via-white to-orange-50 p-6 shadow-sm">
        <h1 className="font-display text-2xl font-bold text-gray-900">{t("tl_dashboard.title")}</h1>
        <p className="mt-1 text-gray-600">{t("tl_dashboard.subtitle")}</p>
      </div>
      <div className="mb-3 rounded-3xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <a href="#activity-kpi" className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            Activity
          </a>
          <a href="#activity-timeline" className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            Timeline
          </a>
          <a href="#referral-link" className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            Referral link
          </a>
          <a href="#invite-email" className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            Invite by email
          </a>
          <a href="#reserved-emails" className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            Reserved emails
          </a>
          <a href="#welcome-message" className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            Welcome message
          </a>
          <a href="#your-referrals" className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            Your referrals
          </a>
        </div>
      </div>
    </>
  );

  return (
    <ControlPanelLayout
      panelLabel={t("tl.panel_label")}
      mobileTitle={t("tl.mobile_title")}
      homeTo="/tl-dashboard"
      user={{
        fullName: (user as any).full_name,
        email: (user as any).email,
        roleLabel: t("tl.role_label"),
        avatarUrl: (user as any).avatar_url,
      }}
      navItems={buildTeamLeaderNavItems(eventUnreadCount || 0)}
      topContent={topContent}
    >
      <div className="min-h-full">
      <main className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 md:py-8 md:pb-8 lg:px-8">
      {inviteSuccessCount !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-gray-200">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-100">
              <svg className="h-6 w-6 text-success-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-center font-display text-lg font-semibold text-gray-900">{t("tl_dashboard.success_title")}</h3>
            <p className="mt-2 text-center text-sm text-gray-600">
              {inviteSuccessCount === 1
                ? t("tl_dashboard.invite_sent_single")
                : `${t("tl_dashboard.invite_sent_multi_prefix")} ${inviteSuccessCount} ${t("tl_dashboard.invite_sent_multi_suffix")}`}
            </p>
            <button
              type="button"
              className="btn-primary rounded-full w-full mt-5"
              onClick={() => setInviteSuccessCount(null)}
            >
              {t("tl_dashboard.ok")}
            </button>
          </div>
        </div>
      )}

      {/* Action feedback */}
      {actionError && (
        <div className="mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm">
          {actionError}
        </div>
      )}
      {actionData?.success && actionMessage && (
        <div className="mb-4 p-3 rounded-lg bg-success-50 text-success-700 text-sm">{actionMessage}</div>
      )}

      <div id="activity-kpi" className="mb-6 scroll-mt-24 grid grid-cols-1 gap-5 2xl:grid-cols-2">
        {/* Your activity */}
        <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-display text-lg font-semibold text-gray-900">Your activity</h2>
          <div className="grid grid-cols-3 gap-2">
            <div className="h-full min-h-[104px] rounded-xl border border-brand-200 bg-brand-50 p-3 flex flex-col">
              <p className="text-[11px] uppercase tracking-wide text-brand-700">Total runners</p>
              <div className="flex flex-1 items-center justify-center">
                <p className="text-2xl font-bold text-brand-700">{stats.totalReferrals}</p>
              </div>
            </div>
            <div className="h-full min-h-[104px] rounded-xl border border-gray-200 bg-gray-50 p-3 flex flex-col">
              <p className="text-[11px] uppercase tracking-wide text-gray-600">{t("tl_dashboard.new_last_30")}</p>
              <div className="flex flex-1 items-center justify-center">
                <p className="text-2xl font-bold text-gray-900">{stats.newInLast30Days}</p>
              </div>
            </div>
            <div className="h-full min-h-[104px] rounded-xl border border-gray-200 bg-gray-50 p-3 flex flex-col">
              <p className="text-[11px] uppercase tracking-wide text-gray-600">Active runners</p>
              <div className="flex flex-1 items-center justify-center">
                <p className="text-2xl font-bold text-brand-600">{stats.activeReferrals}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Team activity */}
        <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-display text-lg font-semibold text-gray-900">Team activity</h2>
          <div className="grid grid-cols-3 gap-2">
            <div className="h-full min-h-[104px] rounded-xl border border-brand-200 bg-brand-50 p-3 flex flex-col">
              <p className="text-[11px] uppercase tracking-wide text-brand-700">Team listings</p>
              <div className="flex flex-1 items-center justify-center">
                <p className="text-2xl font-bold text-brand-700">{stats.teamListings}</p>
              </div>
            </div>
            <div className="h-full min-h-[104px] rounded-xl border border-gray-200 bg-gray-50 p-3 flex flex-col">
              <p className="text-[11px] uppercase tracking-wide text-gray-600">Conversations started</p>
              <div className="flex flex-1 items-center justify-center">
                <p className="text-2xl font-bold text-gray-900">{stats.teamConversationsStarted}</p>
              </div>
            </div>
            <div className="h-full min-h-[104px] rounded-xl border border-gray-200 bg-gray-50 p-3 flex flex-col">
              <p className="text-[11px] uppercase tracking-wide text-gray-600">Saved listings</p>
              <div className="flex flex-1 items-center justify-center">
                <p className="text-2xl font-bold text-brand-600">{stats.teamSaved}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Activity timeline */}
      <div id="activity-timeline" className="scroll-mt-24 bg-white rounded-3xl p-6 border border-gray-200 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-gray-900">Activity timeline</h2>
          <span className="text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 font-medium">Latest updates</span>
        </div>
        {timelineItems.length > 0 ? (
          <div className="space-y-2">
            {timelineItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      item.type === "accepted" ? "bg-success-500" : item.type === "joined" ? "bg-brand-500" : "bg-amber-500"
                    }`}
                  />
                  <p className="text-sm font-medium text-gray-800">{item.title}</p>
                </div>
                <span className="text-xs text-gray-500">{new Date(item.at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No recent activity yet.</p>
        )}
      </div>

      {/* Referral Link */}
      <div id="referral-link" className="scroll-mt-24 bg-white rounded-3xl p-6 border border-gray-200 shadow-sm mb-6">
        <h2 className="font-display font-semibold text-gray-900 mb-2">{t("tl_dashboard.referral_link_title")}</h2>
        <p className="text-sm text-gray-500 mb-4">{t("tl_dashboard.referral_link_help")}</p>

        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 bg-gray-50 rounded-lg px-4 py-2.5 font-mono text-sm text-gray-700 border border-gray-200 truncate">
            {referralLink}
          </div>
          <button
            onClick={copyLink}
            className="btn-primary rounded-full text-sm px-4 py-2.5 flex-shrink-0"
          >
            {copied ? t("tl_dashboard.copied") : t("tl_dashboard.copy")}
          </button>
        </div>

        {/* Customize code */}
        <Form method="post" className="flex items-end gap-3">
          <input type="hidden" name="_action" value="updateCode" />
          <div className="flex-1">
            <label htmlFor="referralCode" className="label">{t("tl_dashboard.custom_code")}</label>
            <div className="flex items-center">
              <span className="text-sm text-gray-400 mr-1">/join/</span>
              <input
                type="text"
                id="referralCode"
                name="referralCode"
                defaultValue={(user as any).referral_code || ""}
                placeholder={t("tl_dashboard.code_placeholder")}
                className="input flex-1 uppercase"
                maxLength={20}
              />
            </div>
          </div>
          <button type="submit" className="btn-secondary rounded-full text-sm px-4 py-2">
            {t("tl_dashboard.save_code")}
          </button>
        </Form>
      </div>

      {/* Invite by email */}
      <div id="invite-email" className="scroll-mt-24 bg-white rounded-3xl p-6 border border-gray-200 shadow-sm mb-6">
        <h2 className="font-display font-semibold text-gray-900 mb-2">{t("tl_dashboard.invite_by_email")}</h2>

        <Form method="post" className="space-y-3">
          <input type="hidden" name="_action" value="sendInvites" />
          {Array.from({ length: inviteFields }).map((_, index) => (
            <input
              key={index}
              type="email"
              name={`inviteEmail${index}`}
              placeholder={t("tl_dashboard.email_placeholder")}
              className="input"
              required={index === 0}
            />
          ))}

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary rounded-full text-xs px-3 py-1.5"
              onClick={() => setInviteFields((prev) => Math.min(MAX_BATCH_INVITES, prev + 1))}
              disabled={inviteFields >= MAX_BATCH_INVITES}
            >
              {t("tl_dashboard.add_email")}
            </button>
            <button
              type="button"
              className="btn-secondary rounded-full text-xs px-3 py-1.5"
              onClick={() => setInviteFields((prev) => Math.max(1, prev - 1))}
              disabled={inviteFields <= 1}
            >
              {t("tl_dashboard.remove")}
            </button>
            <span className="text-xs text-gray-500">{inviteFields}/{MAX_BATCH_INVITES}</span>
          </div>

          <button type="submit" className="btn-primary rounded-full text-sm px-4 py-2">
            {t("tl_dashboard.send_invitations")}
          </button>
        </Form>
      </div>

      {/* Reserved emails */}
      <div id="reserved-emails" className="scroll-mt-24 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-display font-semibold text-gray-900">{t("tl_dashboard.reserved_emails")}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              to={reservedBuildUrl({ reservedView: "not_joined", reservedPage: 1 })}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                reservedPagination.view === "not_joined"
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t("tl_dashboard.not_joined_yet")} ({reservedCounts.notJoined})
            </Link>
            <Link
              to={reservedBuildUrl({ reservedView: "linked", reservedPage: 1 })}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                reservedPagination.view === "linked"
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t("tl_dashboard.linked")} ({reservedCounts.linked})
            </Link>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
            <span>{t("tl_dashboard.show")}</span>
            {reservedPagination.perPageOptions.map((option: number) => (
              <Link
                key={option}
                to={reservedBuildUrl({ reservedPerPage: option, reservedPage: 1 })}
                className={`px-2.5 py-1 rounded-full ${
                  reservedPagination.perPage === option
                    ? "bg-brand-100 text-brand-700 font-medium"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {option}
              </Link>
            ))}
            <span>{t("tl_dashboard.per_page")}</span>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {reservedEmails.length > 0 ? (
            reservedEmails.map((invite: any) => (
              <div key={invite.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{invite.email}</p>
                  <p className="text-xs text-gray-500">
                    {t("tl_dashboard.added")} {new Date(invite.created_at).toLocaleDateString()}
                    {invite.claimed_at ? ` · ${t("tl_dashboard.claimed")} ${new Date(invite.claimed_at).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      invite.status === "accepted"
                        ? "bg-success-100 text-success-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {reservedStatusLabel[invite.status] || invite.status}
                  </span>
                  {invite.status !== "accepted" && (
                    <Form method="post">
                      <input type="hidden" name="_action" value="resendInvite" />
                      <input type="hidden" name="inviteId" value={invite.id} />
                      <button type="submit" className="btn-secondary rounded-full text-xs px-3 py-1.5">
                        {t("tl_dashboard.resend_invitation")}
                      </button>
                    </Form>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-sm text-gray-500">
              {reservedPagination.view === "linked" ? t("tl_dashboard.no_linked_emails") : t("tl_dashboard.no_pending_reserved_emails")}
            </div>
          )}
        </div>
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
          <span>
            {t("tl_dashboard.page")} {reservedPagination.page} {t("tl_dashboard.of")} {reservedPagination.totalPages} · {reservedPagination.totalCount} {t("tl_dashboard.total")}
          </span>
          <div className="flex items-center gap-2">
            <Link
              to={reservedBuildUrl({ reservedPage: Math.max(1, reservedPagination.page - 1) })}
              className={`px-2.5 py-1 rounded-full ${
                reservedPagination.page <= 1 ? "bg-gray-100 text-gray-400 pointer-events-none" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t("tl_dashboard.prev")}
            </Link>
            <Link
              to={reservedBuildUrl({ reservedPage: Math.min(reservedPagination.totalPages, reservedPagination.page + 1) })}
              className={`px-2.5 py-1 rounded-full ${
                reservedPagination.page >= reservedPagination.totalPages
                  ? "bg-gray-100 text-gray-400 pointer-events-none"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t("tl_dashboard.next")}
            </Link>
          </div>
        </div>
      </div>

      {/* Welcome message */}
      <div id="welcome-message" className="scroll-mt-24 bg-white rounded-3xl p-6 border border-gray-200 shadow-sm mb-6">
        <h2 className="font-display font-semibold text-gray-900 mb-2">{t("tl_dashboard.welcome_message")}</h2>
        <p className="text-sm text-gray-500 mb-4">
          {t("tl_dashboard.welcome_message_help")}
        </p>
        <Form method="post">
          <input type="hidden" name="_action" value="updateWelcome" />
          <textarea
            name="welcomeMessage"
            rows={3}
            defaultValue={(user as any).tl_welcome_message || ""}
            placeholder={t("tl_dashboard.welcome_message_placeholder")}
            className="input w-full mb-3"
            maxLength={500}
          />
          <button type="submit" className="btn-secondary rounded-full text-sm">
            {t("tl_dashboard.save_message")}
          </button>
        </Form>
      </div>

      {/* Referrals list */}
      <div id="your-referrals" className="scroll-mt-24 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-display font-semibold text-gray-900">{t("tl_dashboard.your_referrals")}</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {referrals.length > 0 ? (
            referrals.map((ref: any) => {
              const refUser = referredUsers[ref.referred_user_id];
              return (
                <div key={ref.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-brand-100 flex items-center justify-center text-brand-700 font-semibold flex-shrink-0 text-sm">
                      {refUser?.avatar_url ? (
                        <img
                          src={refUser.avatar_url}
                          alt={refUser?.full_name || refUser?.email || t("settings.unknown_user")}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        refUser?.full_name?.charAt(0) || refUser?.email?.charAt(0)?.toUpperCase() || "?"
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {refUser?.full_name || refUser?.email || t("settings.unknown_user")}
                      </p>
                      {refUser?.email && refUser?.full_name && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {refUser.email}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">
                          {t("tl_dashboard.joined")} {new Date(ref.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                      ref.status === "active"
                        ? "bg-success-100 text-success-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {ref.status === "active" ? t("tl_dashboard.active") : t("tl_dashboard.registered")}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-sm text-gray-500 mb-1">{t("tl_dashboard.no_referrals_yet")}</p>
              <p className="text-xs text-gray-400">{t("tl_dashboard.no_referrals_help")}</p>
            </div>
          )}
        </div>
      </div>
      </main>
    </div>
    </ControlPanelLayout>
  );
}
