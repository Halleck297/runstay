import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect } from "react-router";
import { useLoaderData } from "react-router";
import { useState } from "react";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { buildTeamLeaderNavItems } from "~/components/panelNav";
import { useI18n } from "~/hooks/useI18n";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { getTlEventNotificationSummary } from "~/lib/tl-event-notifications.server";
import { isTeamLeader } from "~/lib/user-access";

export const meta: MetaFunction = () => [{ title: "Your Runners - Team Leader - Runoot" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!isTeamLeader(user)) return redirect("/to-panel");

  const eventNotificationSummary = await getTlEventNotificationSummary((user as any).id);
  const { data: referrals } = await supabaseAdmin
    .from("referrals")
    .select("id, referral_code_used, status, created_at, referred_user_id")
    .eq("team_leader_id", (user as any).id)
    .neq("referred_user_id", (user as any).id)
    .order("created_at", { ascending: false });

  const referralIds = (referrals || []).map((r: any) => r.referred_user_id);
  let referredUsers: Record<string, any> = {};
  if (referralIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", referralIds);

    if (profiles) {
      referredUsers = Object.fromEntries((profiles as any[]).map((p) => [p.id, p]));
    }
  }

  return {
    user,
    referrals: referrals || [],
    referredUsers,
    eventUnreadCount: eventNotificationSummary.totalUnread,
  };
}

export default function TLRunnersPage() {
  const { t, locale } = useI18n();
  const { user, referrals, referredUsers, eventUnreadCount } = useLoaderData<typeof loader>();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"date" | "name">("date");
  const statusCycleOrder = ["registered", "active", "unactive"] as const;
  const [statusPriority, setStatusPriority] = useState<(typeof statusCycleOrder)[number]>("registered");

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
  const normalizeStatus = (status: string | null | undefined): "registered" | "active" | "unactive" => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "active") return "active";
    if (normalized === "registered") return "registered";
    return "unactive";
  };
  const cycleStatusPriority = () => {
    setStatusPriority((prev) => {
      const currentIndex = statusCycleOrder.indexOf(prev);
      const nextIndex = (currentIndex + 1) % statusCycleOrder.length;
      return statusCycleOrder[nextIndex];
    });
  };
  const statusButtonLabel =
    statusPriority === "registered"
      ? t("tl_dashboard.status_registered")
      : statusPriority === "active"
        ? t("tl_dashboard.status_active")
        : t("tl_dashboard.status_unactive");
  const getAvatarFallbackInitial = (fullName: string | null | undefined, email: string | null | undefined) => {
    const safeName = String(fullName || "").trim();
    if (safeName.length > 0) return safeName.charAt(0).toUpperCase();
    const safeEmail = String(email || "").trim();
    if (safeEmail.length > 0) return safeEmail.charAt(0).toUpperCase();
    return "?";
  };
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleReferrals = [...referrals]
    .filter((ref: any) => {
      if (!normalizedQuery) return true;
      const refUser = referredUsers[ref.referred_user_id];
      const name = String(refUser?.full_name || "").toLowerCase();
      const email = String(refUser?.email || "").toLowerCase();
      return name.includes(normalizedQuery) || email.includes(normalizedQuery);
    })
    .sort((a: any, b: any) => {
      const statusA = normalizeStatus(a.status);
      const statusB = normalizeStatus(b.status);
      const rankA = statusA === statusPriority ? 0 : 1;
      const rankB = statusB === statusPriority ? 0 : 1;
      if (rankA !== rankB) return rankA - rankB;

      if (sortMode === "name") {
        const userA = referredUsers[a.referred_user_id];
        const userB = referredUsers[b.referred_user_id];
        const labelA = String(userA?.full_name || userA?.email || "").toLowerCase();
        const labelB = String(userB?.full_name || userB?.email || "").toLowerCase();
        return labelA.localeCompare(labelB);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  const hasAnyReferrals = referrals.length > 0;

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
      <div className="min-h-full px-0 pt-0 pb-2 md:mx-auto md:max-w-7xl md:px-8 md:py-8 md:pb-8">
        <div className="mt-3 mb-6 rounded-3xl border border-brand-500 bg-white px-4 py-4 md:mx-auto md:mt-0 md:mb-8 md:w-[58%] md:border-2 md:p-6 lg:w-[52%]">
          <h1 className="text-center font-display text-2xl font-bold text-gray-900 underline decoration-accent-500 underline-offset-4">{t("tl_dashboard.your_team")}</h1>
          <p className="mt-1 text-center text-gray-600">{t("tl_dashboard.runners_subtitle")}</p>
        </div>

        <div id="your-referrals" className="overflow-hidden border-t border-brand-300 bg-white md:mx-auto md:w-[74%] md:rounded-3xl md:border md:border-brand-300 lg:w-[68%]">
          <div className="border-b border-gray-100 px-4 py-4 md:px-6">
            <h2 className="ml-2 text-left font-display text-xl font-semibold text-gray-900 underline decoration-accent-500 underline-offset-4">{t("tl_dashboard.your_referrals")}</h2>
            <div className="mt-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("tl_dashboard.search_name_or_email")}
                className="w-full rounded-full border border-accent-500 bg-white px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 md:max-w-xs md:text-sm"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSortMode("date")}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    sortMode === "date" ? "border-brand-500 bg-brand-500 text-white" : "border-accent-500 bg-white text-gray-700"
                  }`}
                >
                  {t("tl_dashboard.sort_by_date")}
                </button>
                <button
                  type="button"
                  onClick={() => setSortMode("name")}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    sortMode === "name" ? "border-brand-500 bg-brand-500 text-white" : "border-accent-500 bg-white text-gray-700"
                  }`}
                >
                  {t("tl_dashboard.sort_by_name")}
                </button>
                <button
                  type="button"
                  onClick={cycleStatusPriority}
                  className="rounded-full border border-accent-500 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors"
                >
                  {statusButtonLabel}
                </button>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {visibleReferrals.length > 0 ? (
              visibleReferrals.map((ref: any) => {
                const refUser = referredUsers[ref.referred_user_id];
                return (
                  <div key={ref.id} className="flex items-center justify-between p-4">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                        {typeof refUser?.avatar_url === "string" && refUser.avatar_url.trim().length > 0 ? (
                          <img
                            src={refUser.avatar_url}
                            alt={refUser?.full_name || refUser?.email || t("settings.unknown_user")}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          getAvatarFallbackInitial(refUser?.full_name, refUser?.email)
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {refUser?.full_name || (refUser?.email ? preventAutoLink(refUser.email) : t("settings.unknown_user"))}
                        </p>
                        {refUser?.email && refUser?.full_name && (
                          <p className="mt-0.5 truncate text-xs text-gray-500">{preventAutoLink(refUser.email)}</p>
                        )}
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="text-xs text-gray-500" suppressHydrationWarning>
                            {t("tl_dashboard.joined")} {formatDate(ref.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span
                      className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        normalizeStatus(ref.status) === "active"
                          ? "bg-success-100 text-success-700"
                          : normalizeStatus(ref.status) === "registered"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                          {normalizeStatus(ref.status) === "active"
                        ? t("tl_dashboard.active")
                        : normalizeStatus(ref.status) === "registered"
                          ? t("tl_dashboard.registered")
                          : t("tl_dashboard.unactive")}
                    </span>
                  </div>
                );
              })
            ) : hasAnyReferrals ? (
              <div className="p-8 text-center">
                <p className="mb-1 text-sm text-gray-500">{t("tl_dashboard.no_runners_match_search")}</p>
                <p className="text-xs text-gray-400">{t("tl_dashboard.try_another_name_or_email")}</p>
              </div>
            ) : (
              <div className="p-8 text-center">
                <svg className="mx-auto mb-3 h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="mb-1 text-sm text-gray-500">{t("tl_dashboard.no_referrals_yet")}</p>
                <p className="text-xs text-gray-400">{t("tl_dashboard.no_referrals_help")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ControlPanelLayout>
  );
}
