// app/routes/tl-dashboard.tsx - Team Leader Dashboard
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { useLoaderData, useActionData } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { useEffect, useState, type MouseEvent } from "react";
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
      const referralLink = `${appUrl}/${String((user as any).referral_code || "").toLowerCase()}`;
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
      const referralLink = `${appUrl}/${String((user as any).referral_code || "").toLowerCase()}`;

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
  const { t, locale } = useI18n();
  const {
    user,
    referrals,
    referredUsers,
    stats,
    recentInvites,
    eventUnreadCount,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | { error?: string; success?: boolean; message?: string; errorKey?: never; messageKey?: never }
    | { errorKey?: string; error?: never; success?: boolean; message?: never; messageKey?: never }
    | { success?: boolean; messageKey?: string; message?: never; error?: never; errorKey?: never }
    | undefined;
  const [timelineHydrated, setTimelineHydrated] = useState(false);
  const formatDateTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    const datePart = new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(parsed);
    const timePart = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(parsed);
    return `${datePart}, ${timePart}`;
  };
  const preventAutoLink = (value: string) =>
    value.replace(/@/g, "@\u200B").replace(/\./g, ".\u200B");

  const timelineItems = [
    ...((recentInvites || []).map((invite: any) => ({
      id: `invite-${invite.id}`,
      type: invite.status === "accepted" ? "accepted" : "sent",
      title: (() => {
        const invitedEmail = invite.email ? preventAutoLink(String(invite.email)) : t("common.user");
        if (invite.status === "accepted") {
          const acceptedProfile = Object.values(referredUsers || {}).find(
            (profile: any) => String(profile?.email || "").toLowerCase() === String(invite.email || "").toLowerCase(),
          ) as any;
          const acceptedLabel = acceptedProfile?.full_name || (acceptedProfile?.email ? preventAutoLink(acceptedProfile.email) : invitedEmail);
          return `${t("tl_dashboard.timeline.invite_accepted")}:\n${acceptedLabel}`;
        }
        return `${t("tl_dashboard.timeline.invite_sent")}:\n${invitedEmail}`;
      })(),
      at: invite.claimed_at || invite.updated_at || invite.created_at,
    })) || []),
    ...((referrals || []).map((ref: any) => {
      const refUser = referredUsers[ref.referred_user_id];
      const safeRefLabel = refUser?.full_name || (refUser?.email ? preventAutoLink(refUser.email) : t("tl_dashboard.timeline.runner_fallback"));
      return {
        id: `referral-${ref.id}`,
        type: "joined",
        title: `${t("common.user")} ${t("tl_dashboard.joined").toLowerCase()}:\n${safeRefLabel}`,
        at: ref.created_at,
      };
    }) || []),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 10);
  const actionError =
    actionData?.errorKey ? t(`tl_dashboard.error.${actionData.errorKey}` as any) : actionData?.error;
  const actionMessage =
    actionData?.messageKey ? t(actionData.messageKey as any) : actionData?.message;
  const handleSectionJump = (sectionId: string) => {
    if (typeof window === "undefined") return;
    const target = document.getElementById(sectionId);
    if (!target) return;

    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) {
      // Mobile offset = global mobile nav + TL panel bar + breathing space.
      const mobileOffset = 124;
      const top = target.getBoundingClientRect().top + window.scrollY - mobileOffset;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const navEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navEntry?.type === "reload") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, []);

  useEffect(() => {
    setTimelineHydrated(true);
  }, []);

  const topContent = (
    <>
      <div className="mt-3 mb-4 rounded-3xl border border-brand-500 bg-white px-4 py-4 text-center md:mx-auto md:mt-0 md:mb-3 md:w-[78%] md:border-2 md:border-brand-500 md:bg-white md:p-6 md:text-center md:shadow-sm lg:w-[72%]">
        <h1 className="font-display text-2xl font-bold text-gray-900 underline decoration-accent-500 underline-offset-4">{t("nav.dashboard")}</h1>
        <p className="mt-1 text-gray-600">{t("tl_dashboard.subtitle")}</p>
      </div>
    </>
  );
  const renderedTimelineItems = timelineHydrated ? timelineItems : [];

  return (
    <ControlPanelLayout
      panelLabel={t("tl.panel_label")}
      mobileTitle={t("tl.mobile_title")}
      homeTo="/tl-dashboard"
      compactSidebarUnder391
      user={{
        fullName: (user as any).full_name,
        email: (user as any).email,
        roleLabel: t("tl.role_label"),
        avatarUrl: (user as any).avatar_url,
      }}
      navItems={buildTeamLeaderNavItems(eventUnreadCount || 0)}
      topContent={topContent}
    >
      <div className="min-h-full px-0 pt-0 pb-8 md:mx-auto md:max-w-7xl md:px-8 md:py-8 md:pb-8">
      {/* Action feedback */}
      {actionError && (
        <div className="mb-4 p-3 bg-alert-50 text-alert-700 text-sm md:rounded-lg">
          {actionError}
        </div>
      )}
      {actionData?.success && actionMessage && (
        <div className="mb-4 p-3 bg-success-50 text-success-700 text-sm md:rounded-lg">{actionMessage}</div>
      )}

      <div id="activity-kpi" className="mb-4 scroll-mt-32 md:scroll-mt-24 grid grid-cols-1 gap-4 md:mb-6 md:gap-5 2xl:grid-cols-2">
        {/* Your activity */}
        <section className="rounded-3xl border border-brand-300 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-display text-lg font-semibold text-gray-900 underline decoration-accent-500 underline-offset-4">{t("tl_dashboard.section.your_activity")}</h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="flex min-h-[72px] items-center justify-between gap-3 rounded-3xl border border-brand-300 bg-brand-50 p-3 md:min-h-[104px] md:flex-col">
              <p className="text-[11px] uppercase tracking-wide text-brand-700 md:text-center">{t("tl_dashboard.metric.total_runners")}</p>
              <p className="text-2xl font-bold text-brand-700">{stats.totalReferrals}</p>
            </div>
            <div className="flex min-h-[72px] items-center justify-between gap-3 rounded-3xl border border-brand-300 bg-gray-50 p-3 md:min-h-[104px] md:flex-col">
              <p className="text-[11px] uppercase tracking-wide text-gray-600 md:text-center">{t("tl_dashboard.new_last_30")}</p>
              <p className="text-2xl font-bold text-gray-900">{stats.newInLast30Days}</p>
            </div>
            <div className="flex min-h-[72px] items-center justify-between gap-3 rounded-3xl border border-brand-300 bg-gray-50 p-3 md:min-h-[104px] md:flex-col">
              <p className="text-[11px] uppercase tracking-wide text-gray-600 md:text-center">{t("tl_dashboard.metric.active_runners")}</p>
              <p className="text-2xl font-bold text-brand-600">{stats.activeReferrals}</p>
            </div>
          </div>
        </section>

        {/* Team activity */}
        <section className="rounded-3xl border border-brand-300 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-display text-lg font-semibold text-gray-900 underline decoration-accent-500 underline-offset-4">{t("tl_dashboard.section.team_activity")}</h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="flex min-h-[72px] items-center justify-between gap-3 rounded-3xl border border-brand-300 bg-brand-50 p-3 md:min-h-[104px] md:flex-col">
              <p className="text-[11px] uppercase tracking-wide text-brand-700 md:text-center">{t("tl_dashboard.metric.team_listings")}</p>
              <p className="text-2xl font-bold text-brand-700">{stats.teamListings}</p>
            </div>
            <div className="flex min-h-[72px] items-center justify-between gap-3 rounded-3xl border border-brand-300 bg-gray-50 p-3 md:min-h-[104px] md:flex-col">
              <p className="text-[11px] uppercase tracking-wide text-gray-600 md:text-center">{t("tl_dashboard.metric.conversations_started")}</p>
              <p className="text-2xl font-bold text-gray-900">{stats.teamConversationsStarted}</p>
            </div>
            <div className="flex min-h-[72px] items-center justify-between gap-3 rounded-3xl border border-brand-300 bg-gray-50 p-3 md:min-h-[104px] md:flex-col">
              <p className="text-[11px] uppercase tracking-wide text-gray-600 md:text-center">{t("tl_dashboard.metric.saved_listings")}</p>
              <p className="text-2xl font-bold text-brand-600">{stats.teamSaved}</p>
            </div>
          </div>
        </section>
      </div>

      {/* Activity timeline */}
      <div id="activity-timeline" className="scroll-mt-32 md:scroll-mt-24 mb-4 rounded-3xl border border-brand-300 bg-white p-4 shadow-sm md:mb-6 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-gray-900 underline decoration-accent-500 underline-offset-4">{t("tl_dashboard.section.activity_timeline")}</h2>
          <span className="text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 font-medium">{t("tl_dashboard.timeline.latest_updates")}</span>
        </div>
        {renderedTimelineItems.length > 0 ? (
          <div className="space-y-2">
            {renderedTimelineItems.map((item) => {
              const [activityTypeRaw, ...detailLines] = String(item.title || "").split("\n");
              const activityType = activityTypeRaw || t("tl_dashboard.section.activity_timeline");
              const activityDetails = detailLines.join("\n").trim();

              return (
                <div key={item.id} className="rounded-3xl border border-brand-300 bg-gray-50/60 px-3 py-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                        item.type === "accepted" ? "bg-success-500" : item.type === "joined" ? "bg-brand-500" : "bg-amber-500"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-medium text-gray-800">{activityType}</p>
                        <span className="flex-shrink-0 whitespace-nowrap text-xs text-gray-500" suppressHydrationWarning>
                          {formatDateTime(item.at)}
                        </span>
                      </div>
                      {activityDetails ? (
                        <p className="mt-0.5 whitespace-pre-line break-words text-sm text-gray-700">{activityDetails}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t("tl_dashboard.timeline.no_recent_activity")}</p>
        )}
      </div>

      </div>
    </ControlPanelLayout>
  );
}
