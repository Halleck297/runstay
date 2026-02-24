import type { LoaderFunctionArgs } from "react-router";
import { Outlet, redirect, useLoaderData } from "react-router";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { tourOperatorNavItems } from "~/components/panelNav";
import { requireUser } from "~/lib/session.server";
import { getPublicDisplayName } from "~/lib/user-display";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (user.user_type !== "tour_operator") return redirect("/listings");
  return { user };
}

export default function ToPanelProfileLayout() {
  const { user } = useLoaderData<typeof loader>();
  const publicName = getPublicDisplayName(user);

  return (
    <ControlPanelLayout
      panelLabel="Tour Operator Panel"
      mobileTitle="TO Panel"
      homeTo="/to-panel"
      user={{
        fullName: publicName,
        email: (user as any).email,
        roleLabel: "Tour Operator",
        avatarUrl: (user as any).avatar_url,
      }}
      navItems={tourOperatorNavItems}
    >
      <Outlet />
    </ControlPanelLayout>
  );
}
