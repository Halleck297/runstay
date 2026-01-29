import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { useLoaderData, useActionData, Form, Link } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";

export const meta: MetaFunction = () => {
  return [{ title: "Settings - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
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

export default function Settings() {
  const { user, blockedUsers } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="min-h-full bg-gray-50">
      <Header user={user} />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-gray-900 mb-8">
          Settings
        </h1>

        {/* Account Section */}
        <section className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-gray-900">Email</p>
                <p className="text-sm text-gray-500">{(user as any).email}</p>
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-gray-900">Profile</p>
                <p className="text-sm text-gray-500">Edit your profile information</p>
              </div>
              <Link to="/profile" className="btn-secondary text-sm">
                Edit
              </Link>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900">Password</p>
                <p className="text-sm text-gray-500">Change your password</p>
              </div>
              <button className="btn-secondary text-sm" disabled>
                Coming soon
              </button>
            </div>
          </div>
        </section>

        {/* Blocked Users Section */}
        <section className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Blocked Users</h2>
          
          {actionData && "success" in actionData && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg">
              User has been unblocked successfully.
            </div>
          )}

          {blockedUsers.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {blockedUsers.map((block: any) => (
                <div key={block.id} className="flex items-center justify-between py-3">
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
        </section>

        {/* Notifications Section */}
        <section className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-gray-900">Email notifications</p>
                <p className="text-sm text-gray-500">Receive email for new messages</p>
              </div>
              <button className="btn-secondary text-sm" disabled>
                Coming soon
              </button>
            </div>
          </div>
        </section>

        {/* Support Section */}
        <section className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Support</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-gray-900">Contact us</p>
                <p className="text-sm text-gray-500">Report a problem or send feedback</p>
              </div>
              <Link to="/contact" className="btn-secondary text-sm">
                Contact
              </Link>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900">Terms & Privacy</p>
                <p className="text-sm text-gray-500">Read our terms and privacy policy</p>
              </div>
              <button className="btn-secondary text-sm" disabled>
                Coming soon
              </button>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="card p-6 border-red-200">
          <h2 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h2>
          
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-gray-900">Delete account</p>
              <p className="text-sm text-gray-500">Permanently delete your account and all data</p>
            </div>
            <button className="btn-secondary text-sm text-red-600 border-red-300 hover:bg-red-50" disabled>
              Coming soon
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
