import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData, useLoaderData, useLocation, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
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

export const meta: MetaFunction = () => [{ title: "Your Runners - Team Leader - Runoot" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!isTeamLeader(user)) return redirect("/to-panel");

  const url = new URL(request.url);
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

  const eventNotificationSummary = await getTlEventNotificationSummary((user as any).id);

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

  return {
    user,
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
    eventUnreadCount: eventNotificationSummary.totalUnread,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  if (!isTeamLeader(user)) return data({ errorKey: "not_team_leader" as const }, { status: 403 });

  const formData = await request.formData();
  const actionType = String(formData.get("_action") || "");

  switch (actionType) {
    case "sendInvites": {
      const rawEmails = Array.from(formData.entries())
        .filter(([key]) => key.startsWith("inviteEmail"))
        .map(([, value]) => normalizeEmail(String(value || "")))
        .filter(Boolean);

      const emails = Array.from(new Set(rawEmails));
      if (emails.length === 0) return data({ errorKey: "add_one_email" as const }, { status: 400 });
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
          await (supabaseAdmin.from("referral_invites") as any).update({ updated_at: now }).eq("id", invite.id);
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
        ]
          .filter(Boolean)
          .join(" ");
        return data({ error: details || "No invitations were sent." }, { status: 400 });
      }

      const redirectUrl = new URL(request.url);
      redirectUrl.searchParams.set("inviteSent", String(sentEmails));
      return redirect(`${redirectUrl.pathname}${redirectUrl.search}`);
    }

    case "resendInvite": {
      const inviteId = String(formData.get("inviteId") || "").trim();
      if (!inviteId) return data({ errorKey: "missing_invite_id" as const }, { status: 400 });
      if (!(user as any).referral_code) {
        return data({ errorKey: "missing_referral_code" as const }, { status: 400 });
      }

      const { data: invite } = await (supabaseAdmin.from("referral_invites") as any)
        .select("id, email, status, team_leader_id")
        .eq("id", inviteId)
        .eq("team_leader_id", (user as any).id)
        .maybeSingle();

      if (!invite) return data({ errorKey: "invite_not_found" as const }, { status: 404 });
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

export default function TLRunnersPage() {
  const { t, locale } = useI18n();
  const { user, reservedEmails, reservedPagination, reservedCounts, inviteResult, eventUnreadCount } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | { error?: string; success?: boolean; message?: string; errorKey?: never }
    | { errorKey?: string; error?: never; success?: boolean; message?: never }
    | undefined;
  const location = useLocation();
  const navigate = useNavigate();
  const [inviteFields, setInviteFields] = useState(1);
  const [inviteSuccessCount, setInviteSuccessCount] = useState<number | null>(null);

  const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(parsed);
  };

  const preventAutoLink = (value: string) =>
    value.replace(/@/g, "@\u200B").replace(/\./g, ".\u200B");
  const reservedStatusLabel: Record<string, string> = {
    pending: t("tl_dashboard.reserved"),
    accepted: t("tl_dashboard.linked"),
  };
  const actionError =
    actionData?.errorKey ? t(`tl_dashboard.error.${actionData.errorKey}` as any) : actionData?.error;
  const actionMessage = actionData?.message;

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
    >
      <div className="mx-auto min-h-full max-w-7xl px-4 pt-0 pb-28 sm:px-6 md:py-8 md:pb-8 lg:px-8">
        <div className="mb-6 rounded-3xl border border-brand-200/70 bg-gradient-to-r from-brand-50 via-white to-orange-50 p-6 shadow-sm">
          <h1 className="font-display text-2xl font-bold text-gray-900">{t("tl_dashboard.your_referrals")}</h1>
          <p className="mt-1 text-gray-600">{t("tl_dashboard.invite_by_email")}</p>
        </div>

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
              <button type="button" className="btn-primary rounded-full w-full mt-5" onClick={() => setInviteSuccessCount(null)}>
                {t("tl_dashboard.ok")}
              </button>
            </div>
          </div>
        )}

        {actionError && (
          <div className="mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm">
            {actionError}
          </div>
        )}
        {actionData?.success && actionMessage && (
          <div className="mb-4 p-3 rounded-lg bg-success-50 text-success-700 text-sm">{actionMessage}</div>
        )}

        <div id="invite-email" className="scroll-mt-32 md:scroll-mt-24 bg-white rounded-3xl p-6 border border-gray-200 shadow-sm mb-6">
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

        <div id="reserved-emails" className="scroll-mt-32 md:scroll-mt-24 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden mb-6">
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
                    <p className="text-sm font-medium text-gray-900 truncate">{preventAutoLink(invite.email)}</p>
                    <p className="text-xs text-gray-500">
                      {t("tl_dashboard.added")} {formatDate(invite.created_at)}
                      {invite.claimed_at ? ` · ${t("tl_dashboard.claimed")} ${formatDate(invite.claimed_at)}` : ""}
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
      </div>
    </ControlPanelLayout>
  );
}
