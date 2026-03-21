import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData, useLoaderData, useLocation, useNavigate, useNavigation } from "react-router";
import { useEffect, useState } from "react";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { sendTemplatedEmail } from "~/lib/email/service.server";
import { generateInviteToken } from "~/lib/referral-code.server";
import { useI18n } from "~/hooks/useI18n";
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

export const meta: MetaFunction = () => [{ title: "Referrals - Team Leader - Runoot" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!isTeamLeader(user)) return redirect("/to-panel");

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
    .select("id, email, status, created_at, claimed_at, updated_at")
    .eq("team_leader_id", (user as any).id)
    .eq("status", reservedStatus)
    .order("created_at", { ascending: false })
    .range(reservedFrom, reservedTo);

  return {
    user,
    appUrl,
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
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  if (!isTeamLeader(user)) return data({ errorKey: "not_team_leader" as const }, { status: 403 });

  const formData = await request.formData();
  const actionType = String(formData.get("_action") || "");

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
      if (emails.length === 0) return data({ errorKey: "add_one_email" as const }, { status: 400 });
      if (emails.length > MAX_BATCH_INVITES) {
        return data({ errorKey: "too_many_emails" as const }, { status: 400 });
      }

      const invalidEmails = emails.filter((email) => !EMAIL_PATTERN.test(email));
      if (invalidEmails.length > 0) {
        return data({ errorKey: "invalid_email_format" as const }, { status: 400 });
      }
      if (!(user as any).referral_code) {
        return data({ errorKey: "missing_referral_code" as const }, { status: 400 });
      }

      const now = new Date().toISOString();
      const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
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

      for (const email of emails) {
        if (email === currentUserEmail) {
          continue;
        }

        const invite = invitesByEmail.get(email);
        const existingProfile = profilesByEmail.get(email);
        const existingReferral = existingProfile ? referralsByUserId.get(existingProfile.id) : null;

        if (invite && invite.team_leader_id !== (user as any).id) {
          continue;
        }

        if (existingReferral && existingReferral.team_leader_id !== (user as any).id) {
          continue;
        }

        // Generate a token for the invite link
        const inviteToken = generateInviteToken();

        if (!invite) {
          const { error: insertInviteError } = await (supabaseAdmin.from("referral_invites") as any).insert({
            team_leader_id: (user as any).id,
            email,
            status: "pending",
            token: inviteToken,
            created_at: now,
            updated_at: now,
          });

          if (insertInviteError) {
            continue;
          }
        } else {
          await (supabaseAdmin.from("referral_invites") as any)
            .update({ updated_at: now, token: inviteToken })
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
            continue;
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

        const tokenReferralLink = `${appUrl}/join/${inviteToken}`;
        const sendResult = await sendTemplatedEmail({
          to: email,
          templateId: "referral_invite",
          locale: (user as any).preferred_language || null,
          payload: {
            inviterName: (user as any).full_name || "Your Team Leader",
            referralLink: tokenReferralLink,
            welcomeMessage: (user as any).tl_welcome_message,
          },
        });

        if (!sendResult.ok) {
          continue;
        }

        sentEmails += 1;
      }

      if (sentEmails === 0 && autoLinked === 0) {
        return data({ errorKey: "no_invitations_sent" as const }, { status: 400 });
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

      // Generate a new token for the resend
      const resendToken = generateInviteToken();
      const tokenReferralLink = `${appUrl}/join/${resendToken}`;

      const sendResult = await sendTemplatedEmail({
        to: invite.email,
        templateId: "referral_invite",
        locale: (user as any).preferred_language || null,
        payload: {
          inviterName: (user as any).full_name || "Your Team Leader",
          referralLink: tokenReferralLink,
          welcomeMessage: (user as any).tl_welcome_message,
        },
      });

      if (!sendResult.ok) {
        return data({ errorKey: "resend_failed" as const }, { status: 500 });
      }

      await (supabaseAdmin.from("referral_invites") as any)
        .update({ updated_at: new Date().toISOString(), token: resendToken })
        .eq("id", invite.id);

      return data({ success: true, messageKey: "tl_dashboard.success.invitation_resent" as const, resentInviteId: invite.id });
    }

    default:
      return data({ errorKey: "unknown_action" as const }, { status: 400 });
  }
}

export default function TLReferralsPage() {
  const { t, locale } = useI18n();
  const { user, appUrl, reservedEmails, reservedPagination, reservedCounts, inviteResult } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>() as
    | { error?: string; success?: boolean; message?: string; messageKey?: string; resentInviteId?: string; errorKey?: never }
    | { errorKey?: string; error?: never; success?: boolean; message?: never; messageKey?: never }
    | undefined;
  const location = useLocation();
  const navigate = useNavigate();
  const [inviteFields, setInviteFields] = useState(1);
  const [inviteSuccessCount, setInviteSuccessCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [sentInviteIds, setSentInviteIds] = useState<Set<string>>(new Set());

  const referralSlug = (user as any).referral_slug || String((user as any).referral_code || "").toLowerCase();
  const referralLink = `${appUrl}/${referralSlug}`;
  const referralLinkDisplay = referralLink.replace(/^https?:\/\//i, "");

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

  const copyLink = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralLink);
      } else if (typeof document !== "undefined") {
        const fallbackInput = document.createElement("textarea");
        fallbackInput.value = referralLink;
        fallbackInput.setAttribute("readonly", "");
        fallbackInput.style.position = "absolute";
        fallbackInput.style.left = "-9999px";
        document.body.appendChild(fallbackInput);
        fallbackInput.select();
        document.execCommand("copy");
        document.body.removeChild(fallbackInput);
      } else {
        return;
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
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

  useEffect(() => {
    if (!actionData || !("resentInviteId" in actionData) || !actionData.resentInviteId) return;
    setSentInviteIds((prev) => {
      const next = new Set(prev);
      next.add(actionData.resentInviteId as string);
      return next;
    });
  }, [actionData]);

  return (
    <div className="min-h-full px-0 pt-0 pb-2 md:mx-auto md:max-w-7xl md:px-8 md:py-8 md:pb-8">
        <div className="mt-3 mb-4 rounded-3xl border border-brand-500 bg-white px-4 py-4 md:mx-auto md:mt-0 md:mb-6 md:w-[58%] md:border-2 md:p-6 lg:w-[52%]">
          <h1 className="text-center font-display text-2xl font-bold text-gray-900 underline decoration-accent-500 underline-offset-4">{t("tl_dashboard.invite_users_title")}</h1>
          <p className="mt-1 text-center text-gray-600">{t("tl_dashboard.referrals_subtitle")}</p>
        </div>

        {inviteSuccessCount !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-brand-300">
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
          <div className="mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm md:mx-auto md:w-[78%] lg:w-[72%]">
            {actionError}
          </div>
        )}
        {actionData?.success && actionMessage && (
          <div className="mb-4 p-3 rounded-lg bg-success-50 text-success-700 text-sm md:mx-auto md:w-[78%] lg:w-[72%]">{actionMessage}</div>
        )}

        <div id="referral-link" className="scroll-mt-32 mb-4 border-y border-brand-300 bg-white p-4 md:mx-auto md:w-[78%] md:scroll-mt-24 md:mb-6 md:rounded-3xl md:border md:p-6 md:shadow-sm lg:w-[72%]">
          <h2 className="mb-2 font-display font-semibold text-gray-900 underline decoration-accent-500 underline-offset-4">{t("tl_dashboard.invite_link_title")}</h2>
          <p className="mb-4 text-sm text-gray-500">{t("tl_dashboard.referral_link_help")}</p>

          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
            <div className="w-full flex-1 truncate rounded-lg border border-accent-500 bg-gray-50 px-4 py-2.5 font-mono text-sm text-gray-700 md:hidden">
              {referralLinkDisplay}
            </div>
            <div className="hidden w-full flex-1 truncate rounded-lg border border-accent-500 bg-gray-50 px-4 py-2.5 font-mono text-sm text-gray-700 md:block">
              {referralLink}
            </div>
            <button
              onClick={copyLink}
              className={`mx-auto w-1/2 rounded-full px-4 py-2.5 text-sm transition-colors md:mx-0 md:w-auto md:flex-shrink-0 ${
                copied ? "bg-brand-600 text-white" : "btn-primary"
              }`}
            >
              {copied ? t("tl_dashboard.copied") : t("tl_dashboard.copy")}
            </button>
          </div>
        </div>

        <div id="invite-email" className="scroll-mt-32 mb-4 border-y border-brand-300 bg-white p-4 md:mx-auto md:w-[78%] md:scroll-mt-24 md:mb-6 md:rounded-3xl md:border md:p-6 md:shadow-sm lg:w-[72%]">
          <h2 className="mb-2 font-display font-semibold text-gray-900 underline decoration-accent-500 underline-offset-4">{t("tl_dashboard.invite_by_email")}</h2>

          <Form method="post" className="space-y-3">
            <input type="hidden" name="_action" value="sendInvites" />
            {Array.from({ length: inviteFields }).map((_, index) => (
              <input
                key={index}
                type="email"
                name={`inviteEmail${index}`}
                placeholder={t("tl_dashboard.email_placeholder")}
                className="input border border-solid border-accent-500 bg-white shadow-none"
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

        <div id="welcome-message" className="scroll-mt-32 mb-4 border-y border-brand-300 bg-white p-4 md:mx-auto md:w-[78%] md:scroll-mt-24 md:mb-6 md:rounded-3xl md:border md:p-6 md:shadow-sm lg:w-[72%]">
          <h2 className="mb-2 font-display font-semibold text-gray-900 underline decoration-accent-500 underline-offset-4">{t("tl_dashboard.welcome_message")}</h2>
          <p className="mb-4 text-sm text-gray-500">{t("tl_dashboard.welcome_message_help")}</p>
          <Form method="post">
            <input type="hidden" name="_action" value="updateWelcome" />
            <textarea
              name="welcomeMessage"
              rows={3}
              defaultValue={(user as any).tl_welcome_message || ""}
              placeholder={t("tl_dashboard.welcome_message_placeholder")}
              className="input mb-3 w-full resize-none border border-solid border-accent-500 bg-white shadow-none"
              maxLength={500}
            />
            <button type="submit" className="btn-secondary rounded-full border-accent-500 text-sm">
              {t("tl_dashboard.save_message")}
            </button>
          </Form>
        </div>

        <div id="reserved-emails" className="scroll-mt-32 mb-6 overflow-hidden border-t border-brand-300 bg-white md:mx-auto md:w-[78%] md:scroll-mt-24 md:rounded-3xl md:border md:shadow-sm lg:w-[72%]">
          <div className="px-6 py-4 border-b border-brand-300">
            <h2 className="font-display font-semibold text-gray-900 underline decoration-accent-500 underline-offset-4">{t("tl_dashboard.reserved_emails")}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                to={reservedBuildUrl({ reservedView: "not_joined", reservedPage: 1 })}
                preventScrollReset
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  reservedPagination.view === "not_joined"
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {t("tl_dashboard.reserved")} ({reservedCounts.notJoined})
              </Link>
              <Link
                to={reservedBuildUrl({ reservedView: "linked", reservedPage: 1 })}
                preventScrollReset
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
                    <p className="text-xs text-gray-500" suppressHydrationWarning>
                      <span>
                        {t("tl_dashboard.added")} {formatDate(invite.created_at)}
                        {invite.claimed_at ? ` · ${t("tl_dashboard.claimed")} ${formatDate(invite.claimed_at)}` : ""}
                      </span>
                      {invite.updated_at && invite.updated_at !== invite.created_at ? (
                        <span className="block">{t("tl_dashboard.resent")} {formatDate(invite.updated_at)}</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {invite.status === "accepted" && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-700">
                        {reservedStatusLabel[invite.status] || invite.status}
                      </span>
                    )}
                    {invite.status !== "accepted" && (
                      <Form method="post">
                        <input type="hidden" name="_action" value="resendInvite" />
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <button
                          type="submit"
                          disabled={sentInviteIds.has(invite.id)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                            sentInviteIds.has(invite.id)
                              ? "border-success-600 bg-success-600 text-white"
                              : "border-accent-500 bg-white text-gray-700 hover:bg-accent-500 hover:text-white"
                          }`}
                        >
                          {sentInviteIds.has(invite.id)
                            ? t("tl_dashboard.invitation_sent")
                            : navigation.state === "submitting" &&
                                navigation.formData?.get("_action") === "resendInvite" &&
                                navigation.formData?.get("inviteId") === invite.id
                              ? t("tl_dashboard.sending")
                              : t("tl_dashboard.resend_invitation")}
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
          <div className="px-6 py-3 border-t border-brand-300 flex items-center justify-between text-xs text-gray-600">
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
  );
}
