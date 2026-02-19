// app/routes/admin.users.tsx - Admin Users Management
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { useLoaderData, useActionData, useSearchParams, Form, Link } from "react-router";
import { requireAdmin, logAdminAction, startImpersonation } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import type { UserRole, UserType } from "~/lib/database.types";

export const meta: MetaFunction = () => {
  return [{ title: "Users - Admin - Runoot" }];
};

const ITEMS_PER_PAGE = 20;

export async function loader({ request }: LoaderFunctionArgs) {
  const admin = await requireAdmin(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const typeFilter = url.searchParams.get("type") || "";
  const roleFilter = url.searchParams.get("role") || "";
  const page = parseInt(url.searchParams.get("page") || "1");

  let query = supabaseAdmin
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`);
  }
  if (typeFilter) {
    const allowedUserTypes: UserType[] = ["tour_operator", "private"];
    if (allowedUserTypes.includes(typeFilter as UserType)) {
      query = query.eq("user_type", typeFilter as UserType);
    }
  }
  if (roleFilter) {
    const allowedRoles: UserRole[] = ["user", "admin", "superadmin"];
    if (allowedRoles.includes(roleFilter as UserRole)) {
      query = query.eq("role", roleFilter as UserRole);
    }
  }

  const { data: users, count } = await query;

  return {
    admin,
    users: users || [],
    totalCount: count || 0,
    currentPage: page,
    totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const actionType = formData.get("_action") as string;

  switch (actionType) {
    case "verify": {
      const userId = formData.get("userId") as string;
      const currentStatus = formData.get("currentStatus") === "true";

      await (supabaseAdmin
        .from("profiles") as any)
        .update({ is_verified: !currentStatus })
        .eq("id", userId);

      await logAdminAction((admin as any).id, currentStatus ? "user_unverified" : "user_verified", {
        targetUserId: userId,
      });

      return data({ success: true });
    }

    case "changeRole": {
      const userId = formData.get("userId") as string;
      const newRole = formData.get("newRole") as string;

      if (!["user", "admin", "superadmin"].includes(newRole)) {
        return data({ error: "Invalid role" }, { status: 400 });
      }

      // Only superadmins can change roles
      if ((admin as any).role !== "superadmin") {
        return data({ error: "Only superadmins can change roles" }, { status: 403 });
      }

      await (supabaseAdmin
        .from("profiles") as any)
        .update({ role: newRole })
        .eq("id", userId);

      await logAdminAction((admin as any).id, "role_changed", {
        targetUserId: userId,
        details: { new_role: newRole },
      });

      return data({ success: true });
    }

    case "impersonate": {
      const userId = formData.get("userId") as string;
      // Only allow impersonation of admin-created users
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

    case "toggleTeamLeader": {
      const userId = formData.get("userId") as string;
      const currentStatus = formData.get("currentStatus") === "true";
      const newStatus = !currentStatus;

      let updateData: any = { is_team_leader: newStatus };

      // If promoting, generate referral code
      if (newStatus) {
        const { data: userProfile } = await supabaseAdmin
          .from("profiles")
          .select("full_name, email")
          .eq("id", userId)
          .single();

        const baseName = (userProfile as any)?.full_name || (userProfile as any)?.email?.split("@")[0] || "TL";
        let code = baseName.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 8) + new Date().getFullYear();

        // Check uniqueness
        const { data: existing } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("referral_code", code)
          .single();

        if (existing) {
          code = code + Math.floor(Math.random() * 100);
        }

        updateData.referral_code = code;

        // Send notification
        await (supabaseAdmin.from("notifications") as any).insert({
          user_id: userId,
          type: "tl_promoted",
          title: "You're a Team Leader!",
          message: "An admin has promoted you to Team Leader. Share your referral link from the TL Dashboard!",
          data: { referral_code: code },
        });
      }

      await (supabaseAdmin.from("profiles") as any)
        .update(updateData)
        .eq("id", userId);

      await logAdminAction((admin as any).id, newStatus ? "tl_promoted" : "tl_demoted", {
        targetUserId: userId,
      });

      return data({ success: true });
    }

    case "deleteUser": {
      const userId = formData.get("userId") as string;

      // Only superadmins can delete users
      if ((admin as any).role !== "superadmin") {
        return data({ error: "Only superadmins can delete users" }, { status: 403 });
      }

      // Cannot delete yourself
      if (userId === (admin as any).id) {
        return data({ error: "You cannot delete yourself" }, { status: 400 });
      }

      // Delete related data first (messages, conversations, listings, saved, etc.)
      await (supabaseAdmin.from("messages") as any).delete().eq("sender_id", userId);
      await (supabaseAdmin.from("saved_listings") as any).delete().eq("user_id", userId);
      await (supabaseAdmin.from("conversations") as any).delete().or(`participant_1.eq.${userId},participant_2.eq.${userId}`);
      await (supabaseAdmin.from("listings") as any).delete().eq("author_id", userId);
      await (supabaseAdmin.from("blocked_users") as any).delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
      await (supabaseAdmin.from("reports") as any).delete().eq("reporter_id", userId);

      // Delete profile
      await (supabaseAdmin.from("profiles") as any).delete().eq("id", userId);

      // Delete auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);

      await logAdminAction((admin as any).id, "user_deleted", {
        targetUserId: userId,
      });

      return data({ success: true });
    }

    default:
      return data({ error: "Unknown action" }, { status: 400 });
  }
}

const userTypeLabels: Record<string, string> = {
  tour_operator: "Tour Operator",
  private: "Runner",
};

const roleColors: Record<string, string> = {
  user: "bg-gray-100 text-gray-600",
  admin: "bg-purple-100 text-purple-700",
  superadmin: "bg-red-100 text-red-700",
};

export default function AdminUsers() {
  const { admin, users, totalCount, currentPage, totalPages } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 mt-1">{totalCount} total users</p>
        </div>
        <Link
          to="/admin/users/new"
          className="btn-primary inline-flex items-center gap-2 self-start"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create User
        </Link>
      </div>

      {/* Action feedback */}
      {actionData && "error" in actionData && (
        <div className="mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm">
          {actionData.error}
        </div>
      )}

      {/* Search and filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <Form method="get" className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              name="search"
              placeholder="Search by name, email, or company..."
              defaultValue={searchParams.get("search") || ""}
              className="input w-full"
            />
          </div>
          <select
            name="type"
            defaultValue={searchParams.get("type") || ""}
            className="input"
          >
            <option value="">All types</option>
            <option value="private">Runner</option>
            <option value="tour_operator">Tour Operator</option>
          </select>
          <select
            name="role"
            defaultValue={searchParams.get("role") || ""}
            className="input"
          >
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
          </select>
          <button type="submit" className="btn-accent">
            Search
          </button>
        </Form>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">User</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Type</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Role</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Verified</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Joined</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user: any) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {user.full_name || "No name"}
                      </p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                      {user.company_name && (
                        <p className="text-xs text-gray-400">{user.company_name}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">
                      {userTypeLabels[user.user_type] || user.user_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {(admin as any).role === "superadmin" ? (
                      <Form method="post" className="inline">
                        <input type="hidden" name="_action" value="changeRole" />
                        <input type="hidden" name="userId" value={user.id} />
                        <select
                          name="newRole"
                          defaultValue={user.role}
                          onChange={(e) => e.target.form?.requestSubmit()}
                          className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${roleColors[user.role] || ""}`}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                          <option value="superadmin">superadmin</option>
                        </select>
                      </Form>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[user.role] || ""}`}>
                        {user.role}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Form method="post" className="inline">
                      <input type="hidden" name="_action" value="verify" />
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="currentStatus" value={user.is_verified.toString()} />
                      <button
                        type="submit"
                        className={`text-sm font-medium ${
                          user.is_verified
                            ? "text-brand-600 hover:text-brand-700"
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        {user.is_verified ? (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Verified
                          </span>
                        ) : (
                          "Not verified"
                        )}
                      </button>
                    </Form>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Form method="post" className="inline">
                        <input type="hidden" name="_action" value="toggleTeamLeader" />
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="currentStatus" value={(user.is_team_leader || false).toString()} />
                        <button
                          type="submit"
                          className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                            user.is_team_leader
                              ? "text-purple-700 bg-purple-50 hover:bg-purple-100"
                              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                          }`}
                          title={user.is_team_leader ? "Remove Team Leader" : "Make Team Leader"}
                        >
                          <svg className="w-4 h-4 inline mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                          {user.is_team_leader ? "TL" : "Set TL"}
                        </button>
                      </Form>
                      {user.created_by_admin && (
                        <Form method="post" className="inline">
                          <input type="hidden" name="_action" value="impersonate" />
                          <input type="hidden" name="userId" value={user.id} />
                          <button
                            type="submit"
                            className="text-xs font-medium text-navy-500 hover:text-navy-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                            title="Impersonate this user"
                          >
                            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Impersonate
                          </button>
                        </Form>
                      )}
                      {(admin as any).role === "superadmin" && user.id !== (admin as any).id && (
                        <Form method="post" className="inline" onSubmit={(e) => { if (!confirm(`Delete ${user.full_name || user.email}? This cannot be undone.`)) e.preventDefault(); }}>
                          <input type="hidden" name="_action" value="deleteUser" />
                          <input type="hidden" name="userId" value={user.id} />
                          <button
                            type="submit"
                            className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                            title="Delete this user"
                          >
                            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </Form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {users.map((user: any) => (
            <div key={user.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{user.full_name || "No name"}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                  {user.company_name && (
                    <p className="text-xs text-gray-400">{user.company_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {user.is_team_leader && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      TL
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[user.role] || ""}`}>
                    {user.role}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{userTypeLabels[user.user_type]}</span>
                  <span>·</span>
                  <span>{new Date(user.created_at).toLocaleDateString()}</span>
                  {user.is_verified && (
                    <>
                      <span>·</span>
                      <span className="text-brand-600">Verified</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Form method="post" className="inline">
                    <input type="hidden" name="_action" value="verify" />
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="currentStatus" value={user.is_verified.toString()} />
                    <button type="submit" className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded bg-gray-50">
                      {user.is_verified ? "Unverify" : "Verify"}
                    </button>
                  </Form>
                  <Form method="post" className="inline">
                    <input type="hidden" name="_action" value="toggleTeamLeader" />
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="currentStatus" value={(user.is_team_leader || false).toString()} />
                    <button type="submit" className={`text-xs px-2 py-1 rounded ${user.is_team_leader ? "text-purple-700 bg-purple-50" : "text-gray-500 bg-gray-50"}`}>
                      {user.is_team_leader ? "Remove TL" : "Set TL"}
                    </button>
                  </Form>
                  {user.created_by_admin && (
                    <Form method="post" className="inline">
                      <input type="hidden" name="_action" value="impersonate" />
                      <input type="hidden" name="userId" value={user.id} />
                      <button type="submit" className="text-xs text-navy-500 hover:text-navy-700 px-2 py-1 rounded bg-gray-50">
                        Impersonate
                      </button>
                    </Form>
                  )}
                  {(admin as any).role === "superadmin" && user.id !== (admin as any).id && (
                    <Form method="post" className="inline" onSubmit={(e) => { if (!confirm(`Delete ${user.full_name || user.email}?`)) e.preventDefault(); }}>
                      <input type="hidden" name="_action" value="deleteUser" />
                      <input type="hidden" name="userId" value={user.id} />
                      <button type="submit" className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded bg-red-50">
                        Delete
                      </button>
                    </Form>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {users.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">
            No users found
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link
              to={`/admin/users?page=${currentPage - 1}&search=${searchParams.get("search") || ""}&type=${searchParams.get("type") || ""}&role=${searchParams.get("role") || ""}`}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              to={`/admin/users?page=${currentPage + 1}&search=${searchParams.get("search") || ""}&type=${searchParams.get("type") || ""}&role=${searchParams.get("role") || ""}`}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
