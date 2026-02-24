import type { LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { getUserRoleLabel, isSuperAdmin } from "~/lib/user-access";

export async function loader({ request }: LoaderFunctionArgs) {
  const admin = await requireAdmin(request);

  const { count: pendingCount } = await (supabaseAdmin as any)
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: eventRequestsOpenCount } = await (supabaseAdmin as any)
    .from("event_requests")
    .select("*", { count: "exact", head: true })
    .neq("status", "published");

  return {
    admin,
    pendingCount: pendingCount || 0,
    eventRequestsOpenCount: eventRequestsOpenCount || 0,
  };
}

const baseNavItems = [
  {
    to: "/admin",
    label: "Dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    exact: true,
  },
  {
    to: "/admin/users",
    label: "Users",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    to: "/admin/to-accounts",
    label: "TO Accounts",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M5 21V7l8-4 6 3v15M9 9h.01M9 13h.01M9 17h.01M13 9h.01M13 13h.01M13 17h.01M17 9h.01M17 13h.01M17 17h.01" />
      </svg>
    ),
  },
  {
    to: "/admin/listings",
    label: "Listings",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    to: "/admin/impersonate",
    label: "Impersonate",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    to: "/admin/team-leaders",
    label: "Team Leaders",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    to: "/admin/event-requests",
    label: "Event Requests",
    superadminOnly: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    to: "/admin/events/new",
    label: "Create Event",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    to: "/admin/pending",
    label: "Pending",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function AdminLayout() {
  const { admin, pendingCount, eventRequestsOpenCount } = useLoaderData<typeof loader>();

  const navItems = baseNavItems
    .filter((item: any) => !item.superadminOnly || isSuperAdmin(admin))
    .map((item: any) => {
      if (item.to === "/admin/pending") {
        return { ...item, badgeCount: pendingCount, badgeTone: "accent" as const };
      }
      if (item.to === "/admin/event-requests") {
        return {
          ...item,
          badgeCount: eventRequestsOpenCount,
          badgeTone: "brand" as const,
          hideBadgeWhenActive: true,
        };
      }
      return item;
    });

  return (
    <ControlPanelLayout
      panelLabel="Admin Panel"
      mobileTitle="Admin"
      homeTo="/admin"
      user={{
        fullName: (admin as any)?.full_name as string | null | undefined,
        email: (admin as any)?.email as string | null | undefined,
        roleLabel: getUserRoleLabel(admin),
      }}
      navItems={navItems}
    >
      <Outlet />
    </ControlPanelLayout>
  );
}
