import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect } from "react-router";
import { data } from "react-router";
import { Form, useActionData, useLoaderData, Link, useLocation } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";

export const meta: MetaFunction = () => {
  return [{ title: "Settings - runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  // Redirect tour operators to their profile page
  if (user.user_type === "tour_operator") {
    return redirect("/profile/agency");
  }

  const userId = (user as any).id as string;

  // Get blocked users with their profile info
  const { data: blockedUsers } = await supabaseAdmin
    .from("blocked_users")
    .select(`
      id,
      blocked_id,
      created_at,
      blocked:profiles!blocked_users_blocked_id_fkey(id, full_name, company_name, email)
    `)
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });

  return { user, blockedUsers: blockedUsers || [] };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const userId = (user as any).id as string;

  const formData = await request.formData();
  const intent = formData.get("intent");
  const blockedId = formData.get("blocked_id");

  if (intent === "unblock" && typeof blockedId === "string") {
    await supabaseAdmin
      .from("blocked_users")
      .delete()
      .eq("blocker_id", userId)
      .eq("blocked_id", blockedId);

    return data({ success: true, action: "unblocked" });
  }

  return data({ error: "Invalid action" }, { status: 400 });
}

// Sidebar navigation items
const sidebarNavItems = [
  { name: "Personal information", href: "/profile", icon: "user" },
  { name: "Running Experience", href: "/profile/experience", icon: "running" },
  { name: "Social Media", href: "/profile/social", icon: "share" },
  { name: "Settings", href: "/profile/settings", icon: "settings" },
];

export default function Settings() {
  const { user, blockedUsers } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | { error: string }
    | { success: boolean; action: string }
    | undefined;
  const location = useLocation();

  // Get initials for avatar placeholder
  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />

      <div className="mx-auto max-w-7xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              {/* Avatar */}
              <div className="flex flex-col items-center text-center mb-6">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-2xl font-bold mb-4">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.full_name || "User"}
                      className="h-20 w-20 rounded-full object-cover"
                    />
                  ) : (
                    getInitials(user.full_name)
                  )}
                </div>
                <h2 className="font-display font-semibold text-gray-900 text-lg">
                  {user.full_name || "Your Name"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">{user.email}</p>
                <span className="mt-2 inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                  Private Runner
                </span>
              </div>

              {/* Navigation */}
              <nav className="space-y-1">
                {sidebarNavItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-brand-50 text-brand-700"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      {item.icon === "user" && (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                      {item.icon === "running" && (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )}
                      {item.icon === "share" && (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      )}
                      {item.icon === "settings" && (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <div className="mb-6">
              <h1 className="font-display text-2xl font-bold text-gray-900">
                Settings
              </h1>
              <p className="mt-1 text-gray-500">
                Manage your account preferences and privacy
              </p>
            </div>

            {/* Success Message for Unblock */}
            {actionData && "success" in actionData && actionData.success && (
              <div className="mb-6 rounded-xl bg-success-50 p-4 text-sm text-success-700 flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                User has been unblocked successfully.
              </div>
            )}

            {/* Account Section */}
            <h3 className="font-display font-semibold text-gray-900 text-lg mb-3">Account</h3>
            <div className="grid grid-cols-1 gap-4 mb-6">
              {/* Email - Read only */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="mt-1 text-gray-900 font-medium">{user.email}</p>
                  </div>
                  <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>

              {/* Password */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900">Change password</label>
                    <p className="text-sm text-gray-500 mt-1">Update your account password</p>
                  </div>
                  <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                    Reset password
                  </Link>
                </div>
              </div>
            </div>

            {/* Blocked Users Section */}
            <h3 className="font-display font-semibold text-gray-900 text-lg mb-3">Blocked Users</h3>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
              {blockedUsers.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {blockedUsers.map((block: any) => (
                    <div key={block.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 font-semibold">
                          {block.blocked?.company_name?.charAt(0) ||
                            block.blocked?.full_name?.charAt(0) ||
                            "?"}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {block.blocked?.company_name || block.blocked?.full_name || "Unknown user"}
                          </p>
                          <p className="text-sm text-gray-500">
                            Blocked on {new Date(block.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Form method="post">
                        <input type="hidden" name="intent" value="unblock" />
                        <input type="hidden" name="blocked_id" value={block.blocked_id} />
                        <button
                          type="submit"
                          className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                        >
                          Unblock
                        </button>
                      </Form>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">You haven't blocked any users.</p>
              )}
            </div>

            {/* Notifications Section */}
            <h3 className="font-display font-semibold text-gray-900 text-lg mb-3">Notifications</h3>
            <div className="grid grid-cols-1 gap-4 mb-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900">Email notifications</label>
                    <p className="text-sm text-gray-500 mt-1">Receive emails for new messages</p>
                  </div>
                  <span className="text-sm text-gray-400">Coming soon</span>
                </div>
              </div>
            </div>

            {/* Support Section */}
            <h3 className="font-display font-semibold text-gray-900 text-lg mb-3">Support</h3>
            <div className="grid grid-cols-1 gap-4 mb-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900">Contact us</label>
                    <p className="text-sm text-gray-500 mt-1">Report a problem or send feedback</p>
                  </div>
                  <Link to="/contact" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                    Contact
                  </Link>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900">Terms & Privacy</label>
                    <p className="text-sm text-gray-500 mt-1">Read our terms and privacy policy</p>
                  </div>
                  <div className="flex gap-3">
                    <Link to="/terms" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                      Terms
                    </Link>
                    <Link to="/privacy-policy" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                      Privacy
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <h3 className="font-display font-semibold text-alert-600 text-lg mb-3">Danger Zone</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white rounded-2xl border border-alert-200 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900">Delete account</label>
                    <p className="text-sm text-gray-500 mt-1">Permanently delete your account and all data</p>
                  </div>
                  <span className="text-sm text-gray-400">Coming soon</span>
                </div>
              </div>
            </div>

          </main>

        </div>
      </div>
    </div>
  );
}
