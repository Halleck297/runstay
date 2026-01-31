import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect } from "react-router";
import { data } from "react-router";
import { Form, useActionData, useLoaderData, Link, useLocation } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";

export const meta: MetaFunction = () => {
  return [{ title: "Running Experience - runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  // Redirect tour operators to their profile page
  if (user.user_type === "tour_operator") {
    return redirect("/profile/agency");
  }

  return { user };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();

  const marathonsCompleted = formData.get("marathonsCompleted");
  const marathonPB = formData.get("marathonPB");
  const marathonPBLocation = formData.get("marathonPBLocation");
  const halfMarathonsCompleted = formData.get("halfMarathonsCompleted");
  const halfMarathonPB = formData.get("halfMarathonPB");
  const halfMarathonPBLocation = formData.get("halfMarathonPBLocation");
  const favoriteRaces = formData.get("favoriteRaces");
  const runningGoals = formData.get("runningGoals");

  const updateData = {
    marathons_completed: marathonsCompleted ? parseInt(marathonsCompleted as string) : null,
    marathon_pb: (marathonPB as string) || null,
    marathon_pb_location: (marathonPBLocation as string) || null,
    half_marathons_completed: halfMarathonsCompleted ? parseInt(halfMarathonsCompleted as string) : null,
    half_marathon_pb: (halfMarathonPB as string) || null,
    half_marathon_pb_location: (halfMarathonPBLocation as string) || null,
    favorite_races: (favoriteRaces as string) || null,
    running_goals: (runningGoals as string) || null,
  };

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(updateData)
    .eq("id", user.id);

  if (error) {
    return data({ error: error.message }, { status: 400 });
  }

  return data({ success: true, message: "Running experience updated successfully!" });
}

// Sidebar navigation items
const sidebarNavItems = [
  { name: "Personal information", href: "/profile", icon: "user" },
  { name: "Running Experience", href: "/profile/experience", icon: "running" },
  { name: "Social Media", href: "/profile/social", icon: "share" },
  { name: "Settings", href: "/profile/settings", icon: "settings" },
];

export default function RunningExperience() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | { error: string }
    | { success: boolean; message: string }
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
                Running Experience
              </h1>
              <p className="mt-1 text-gray-500">
                Share your running journey and achievements with the community
              </p>
            </div>

            {/* Success/Error Messages */}
            {actionData && "success" in actionData && actionData.success && (
              <div className="mb-6 rounded-xl bg-success-50 p-4 text-sm text-success-700 flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {"message" in actionData ? actionData.message : ""}
              </div>
            )}

            {actionData && "error" in actionData && actionData.error && (
              <div className="mb-6 rounded-xl bg-alert-50 p-4 text-sm text-alert-700 flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {actionData.error}
              </div>
            )}

            <Form method="post">
              {/* Marathons Section */}
              <h3 className="font-display font-semibold text-gray-900 text-lg mb-3">Marathons</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors">
                  <label className="text-sm font-medium text-gray-500">Completed</label>
                  <input
                    name="marathonsCompleted"
                    type="number"
                    min="0"
                    defaultValue={(user as any).marathons_completed || ""}
                    className="mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                  />
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors">
                  <label className="text-sm font-medium text-gray-500">Personal best</label>
                  <input
                    name="marathonPB"
                    type="text"
                    defaultValue={(user as any).marathon_pb || ""}
                    className="mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none"
                    placeholder="3:45:00"
                  />
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors">
                  <label className="text-sm font-medium text-gray-500">PB Location</label>
                  <input
                    name="marathonPBLocation"
                    type="text"
                    defaultValue={(user as any).marathon_pb_location || ""}
                    className="mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none"
                    placeholder="Berlin 2023"
                  />
                </div>
              </div>

              {/* Half Marathons Section */}
              <h3 className="font-display font-semibold text-gray-900 text-lg mb-3">Half Marathons</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors">
                  <label className="text-sm font-medium text-gray-500">Completed</label>
                  <input
                    name="halfMarathonsCompleted"
                    type="number"
                    min="0"
                    defaultValue={(user as any).half_marathons_completed || ""}
                    className="mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                  />
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors">
                  <label className="text-sm font-medium text-gray-500">Personal best</label>
                  <input
                    name="halfMarathonPB"
                    type="text"
                    defaultValue={(user as any).half_marathon_pb || ""}
                    className="mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none"
                    placeholder="1:45:00"
                  />
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors">
                  <label className="text-sm font-medium text-gray-500">PB Location</label>
                  <input
                    name="halfMarathonPBLocation"
                    type="text"
                    defaultValue={(user as any).half_marathon_pb_location || ""}
                    className="mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none"
                    placeholder="Valencia 2024"
                  />
                </div>
              </div>

              {/* Other Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Favorite Races Card - Full Width */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">Favorite races</label>
                  <textarea
                    name="favoriteRaces"
                    rows={3}
                    defaultValue={(user as any).favorite_races || ""}
                    className="mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none resize-none"
                    placeholder="Berlin Marathon, New York Marathon, Tokyo Marathon..."
                  />
                  <p className="mt-2 text-xs text-gray-400">List the races you've enjoyed the most</p>
                </div>

                {/* Running Goals Card - Full Width */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">Running goals</label>
                  <textarea
                    name="runningGoals"
                    rows={3}
                    defaultValue={(user as any).running_goals || ""}
                    className="mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none resize-none"
                    placeholder="Complete all 6 World Marathon Majors, qualify for Boston..."
                  />
                  <p className="mt-2 text-xs text-gray-400">What are you training for?</p>
                </div>

              </div>

              {/* Save Button */}
              <div className="mt-6">
                <button type="submit" className="btn-primary px-8">
                  Save Changes
                </button>
              </div>
            </Form>
          </main>

        </div>
      </div>
    </div>
  );
}
