// app/routes/admin.impersonate.tsx - Choose user to impersonate
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data, useActionData, useLoaderData, useSearchParams, Form } from "react-router";
import { requireAdmin, startImpersonation, logAdminAction } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export const meta: MetaFunction = () => {
  return [{ title: "Impersonate - Admin - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const admin = await requireAdmin(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";

  // Only show users created by admin (impersonatable)
  let query = supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, user_type, company_name, is_verified, role, created_by_admin, created_at")
    .not("created_by_admin", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`);
  }

  const { data: users } = await query;
  const userRows = users || [];
  const userIds = userRows.map((u: any) => u.id).filter(Boolean);

  let mockIds = new Set<string>();
  if (userIds.length > 0) {
    const { data: mockRows } = await (supabaseAdmin as any)
      .from("mock_accounts")
      .select("user_id")
      .in("user_id", userIds);
    mockIds = new Set((mockRows || []).map((row: any) => String(row.user_id)));
  }

  const usersWithMockFlag = userRows.map((user: any) => ({
    ...user,
    is_mock: mockIds.has(String(user.id)),
  }));

  return { admin, users: usersWithMockFlag };
}

export async function action({ request }: ActionFunctionArgs) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const actionType = String(formData.get("_action") || "impersonate");
  const userId = formData.get("userId") as string;

  if (!userId) {
    return data({ error: "No user selected" }, { status: 400 });
  }

  if (actionType === "deleteMock") {
    const { data: targetUser } = await supabaseAdmin
      .from("profiles")
      .select("id, created_by_admin")
      .eq("id", userId)
      .single();

    const { data: mockRow } = await (supabaseAdmin as any)
      .from("mock_accounts")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!targetUser || !targetUser.created_by_admin || !mockRow?.user_id) {
      return data({ error: "Only admin-created mock users can be deleted from here" }, { status: 403 });
    }

    const canDelete =
      (admin as any).role === "superadmin" || (targetUser as any).created_by_admin === (admin as any).id;
    if (!canDelete) {
      return data({ error: "You can only delete your own mock users" }, { status: 403 });
    }

    await (supabaseAdmin.from("messages") as any).delete().eq("sender_id", userId);
    await (supabaseAdmin.from("saved_listings") as any).delete().eq("user_id", userId);
    await (supabaseAdmin.from("conversations") as any).delete().or(`participant_1.eq.${userId},participant_2.eq.${userId}`);
    await (supabaseAdmin.from("listings") as any).delete().eq("author_id", userId);
    await (supabaseAdmin.from("blocked_users") as any).delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
    await (supabaseAdmin.from("reports") as any).delete().eq("reporter_id", userId);
    await (supabaseAdmin.from("admin_audit_log") as any).delete().or(`target_user_id.eq.${userId},admin_id.eq.${userId}`);
    await (supabaseAdmin.from("tl_invite_tokens") as any).delete().or(`created_by.eq.${userId},used_by.eq.${userId}`);
    await (supabaseAdmin.from("referral_invites") as any).delete().or(`team_leader_id.eq.${userId},claimed_by.eq.${userId}`);
    const { error: profileDeleteError } = await (supabaseAdmin.from("profiles") as any).delete().eq("id", userId);
    if (profileDeleteError) {
      return data({ error: `Profile deletion failed: ${profileDeleteError.message}` }, { status: 500 });
    }
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError && !/not found/i.test(authDeleteError.message || "")) {
      return data({ error: `Auth deletion failed: ${authDeleteError.message}` }, { status: 500 });
    }

    await logAdminAction((admin as any).id, "mock_user_deleted", {
      targetUserId: userId,
    });

    return data({ success: true, message: "Mock user deleted" });
  }

  // Server-side check: only allow impersonation of admin-created users
  const { data: targetUser } = await supabaseAdmin
    .from("profiles")
    .select("id, created_by_admin")
    .eq("id", userId)
    .single();

  if (!targetUser || !(targetUser as any).created_by_admin) {
    return data({ error: "You can only impersonate users created from the admin panel" }, { status: 403 });
  }

  return startImpersonation(request, userId);
}

const userTypeLabels: Record<string, string> = {
  tour_operator: "Tour Operator",
  private: "Runner",
};

export default function AdminImpersonate() {
  const { admin, users } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-900">Impersonate User</h1>
        <p className="text-gray-500 mt-1">
          View and act as a user you created. Only admin-created users can be impersonated.
        </p>
      </div>

      {/* Warning box */}
      <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">
              Actions taken while impersonating will appear as if the user performed them.
            </p>
            <p className="text-xs text-amber-600 mt-1">
              All impersonation sessions are logged in the audit trail.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      {actionData && "error" in actionData && (
        <div className="mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm">
          {actionData.error}
        </div>
      )}
      {actionData && "success" in actionData && actionData.success && (
        <div className="mb-4 p-3 rounded-lg bg-success-50 text-success-700 text-sm">
          {(actionData as any).message || "Operation completed."}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <Form method="get" className="flex gap-3">
          <input
            type="text"
            name="search"
            placeholder="Search by name, email, or company..."
            defaultValue={searchParams.get("search") || ""}
            className="input flex-1"
          />
          <button type="submit" className="btn-accent">
            Search
          </button>
        </Form>
      </div>

      {/* User list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {users.map((user: any) => (
            <div
              key={user.id}
              className={`p-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                user.id === (admin as any).id ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold flex-shrink-0">
                  {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.full_name || "No name"}
                    {user.company_name && (
                      <span className="text-gray-400 font-normal"> · {user.company_name}</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{user.email}</span>
                    {Boolean((user as any).is_mock) && (
                      <>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                          Mock
                        </span>
                      </>
                    )}
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-500">{userTypeLabels[user.user_type]}</span>
                    {user.is_verified && (
                      <>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-brand-600">Verified</span>
                      </>
                    )}
                    {user.role !== "user" && (
                      <>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-purple-600 font-medium">{user.role}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {user.id !== (admin as any).id ? (
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <Form method="post">
                    <input type="hidden" name="_action" value="impersonate" />
                    <input type="hidden" name="userId" value={user.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-navy-700 rounded-lg hover:bg-navy-800 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Impersonate
                    </button>
                  </Form>
                  {Boolean((user as any).is_mock) && (
                    <Form
                      method="post"
                      onSubmit={(e) => {
                        if (!confirm(`Delete mock user ${user.full_name || user.email}?`)) e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="_action" value="deleteMock" />
                      <input type="hidden" name="userId" value={user.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        Delete
                      </button>
                    </Form>
                  )}
                </div>
              ) : (
                <span className="text-xs text-gray-400 flex-shrink-0 ml-4">You</span>
              )}
            </div>
          ))}
        </div>

        {users.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">
            No admin-created users found. Create users from the <a href="/admin/users/new" className="text-brand-600 hover:underline">Users panel</a> to impersonate them.
          </div>
        )}
      </div>
    </div>
  );
}
