import type { LoaderFunctionArgs } from "react-router";
import { Outlet, redirect, useLoaderData } from "react-router";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { buildTeamLeaderNavItems } from "~/components/panelNav";
import { useI18n } from "~/hooks/useI18n";
import { requireUser } from "~/lib/session.server";
import { getTlEventNotificationSummary } from "~/lib/tl-event-notifications.server";
import { isTeamLeader } from "~/lib/user-access";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!isTeamLeader(user)) return redirect("/listings");

  const eventNotificationSummary = await getTlEventNotificationSummary((user as any).id);
  return { user, eventUnreadCount: eventNotificationSummary.totalUnread };
}

export default function TLDashboardProfileLayout() {
  const { t } = useI18n();
  const { user, eventUnreadCount } = useLoaderData<typeof loader>();

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
    >
      <Outlet />
    </ControlPanelLayout>
  );
}
