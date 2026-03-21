import type { LoaderFunctionArgs } from "react-router";
import { Outlet, redirect, useLoaderData } from "react-router";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { buildTeamLeaderNavItems } from "~/components/panelNav";
import { useI18n } from "~/hooks/useI18n";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { generateUniqueReferralSlug } from "~/lib/referral-code.server";
import { getTlEventNotificationSummary } from "~/lib/tl-event-notifications.server";
import { isTeamLeader } from "~/lib/user-access";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!isTeamLeader(user)) return redirect("/listings");

  // Lazy one-time migration: generate referral_slug if missing
  if (!(user as any).referral_slug && (user as any).full_name) {
    const slug = await generateUniqueReferralSlug(supabaseAdmin, (user as any).full_name, (user as any).id);
    await (supabaseAdmin.from("profiles") as any)
      .update({ referral_slug: slug })
      .eq("id", (user as any).id);
  }

  const [eventNotificationSummary, { count: pendingRequestsCount }] = await Promise.all([
    getTlEventNotificationSummary((user as any).id),
    (supabaseAdmin.from("team_join_requests") as any)
      .select("id", { count: "exact", head: true })
      .eq("tl_id", (user as any).id)
      .eq("status", "pending"),
  ]);

  return {
    user,
    eventUnreadCount: eventNotificationSummary.totalUnread,
    pendingRequestsCount: pendingRequestsCount || 0,
  };
}

export default function TLDashboardLayout() {
  const { t } = useI18n();
  const { user, eventUnreadCount, pendingRequestsCount } = useLoaderData<typeof loader>();

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
      navItems={buildTeamLeaderNavItems(eventUnreadCount || 0, pendingRequestsCount || 0)}
    >
      <Outlet />
    </ControlPanelLayout>
  );
}
