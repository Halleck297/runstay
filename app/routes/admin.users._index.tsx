// app/routes/admin.users.tsx - Admin Users Management
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { useLoaderData, useActionData, useSearchParams, Form, Link } from "react-router";
import { useMemo, useState } from "react";
import { requireAdmin, logAdminAction, startImpersonation } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { getProfilePublicId } from "~/lib/publicIds";
import { isSuperAdmin } from "~/lib/user-access";

export const meta: MetaFunction = () => {
  return [{ title: "Users - Admin - Runoot" }];
};

const ITEMS_PER_PAGE = 20;
const SEGMENTS = [
  { id: "all", label: "All" },
  { id: "superadmins", label: "Superadmins" },
  { id: "admins", label: "Admins" },
  { id: "team_leaders", label: "Team Leaders" },
  { id: "tour_operators", label: "Tour Operators" },
  { id: "simple_users", label: "Simple Users" },
] as const;
type SegmentId = (typeof SEGMENTS)[number]["id"];
const CATEGORY_OPTIONS = [
  { value: "superadmin", label: "Superadmin" },
  { value: "admin", label: "Admin" },
  { value: "team_leader", label: "Team Leader" },
  { value: "tour_operator", label: "Tour Operator" },
  { value: "private", label: "User" },
] as const;
type UserCategory = (typeof CATEGORY_OPTIONS)[number]["value"];

export async function loader({ request }: LoaderFunctionArgs) {
  const admin = await requireAdmin(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const segment = (url.searchParams.get("segment") || "all") as SegmentId;
  const page = parseInt(url.searchParams.get("page") || "1");

  let query = supabaseAdmin
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`);
  }
  if (segment === "superadmins") query = query.eq("user_type", "superadmin");
  if (segment === "admins") query = query.eq("user_type", "admin");
  if (segment === "team_leaders") query = query.eq("user_type", "team_leader");
  if (segment === "tour_operators") query = query.eq("user_type", "tour_operator");
  if (segment === "simple_users") {
    query = query.eq("user_type", "private");
  }

  const { data: users, count } = await query;
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

  return {
    admin,
    users: usersWithMockFlag,
    totalCount: count || 0,
    currentPage: page,
    totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE),
    activeSegment: SEGMENTS.some((s) => s.id === segment) ? segment : "all",
    initialSearch: search,
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

    case "setCategory": {
      const userId = formData.get("userId") as string;
      const category = formData.get("category") as UserCategory;

      const allowedCategories: UserCategory[] = ["superadmin", "admin", "team_leader", "tour_operator", "private"];
      if (!allowedCategories.includes(category)) {
        return data({ error: "Invalid category" }, { status: 400 });
      }

      const adminIsSuperAdmin = isSuperAdmin(admin);
      if (!adminIsSuperAdmin && !["team_leader", "private"].includes(category)) {
        return data({ error: "Only superadmins can set this category" }, { status: 403 });
      }

      const updateData: any = {};
      switch (category) {
        case "superadmin":
          updateData.user_type = "superadmin";
          break;
        case "admin":
          updateData.user_type = "admin";
          break;
        case "team_leader":
          updateData.user_type = "team_leader";
          break;
        case "tour_operator":
          updateData.user_type = "tour_operator";
          break;
        case "private":
          updateData.user_type = "private";
          break;
      }

      await (supabaseAdmin.from("profiles") as any)
        .update(updateData)
        .eq("id", userId);

      await logAdminAction((admin as any).id, "user_category_changed", {
        targetUserId: userId,
        details: { category, updateData },
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

    case "deleteUser": {
      const userId = formData.get("userId") as string;

      // Cannot delete yourself
      if (userId === (admin as any).id) {
        return data({ error: "You cannot delete yourself" }, { status: 400 });
      }

      const { data: targetUser } = await (supabaseAdmin as any)
        .from("profiles")
        .select("id, created_by_admin")
        .eq("id", userId)
        .maybeSingle();
      if (!targetUser?.id) {
        return data({ error: "User not found" }, { status: 404 });
      }

      const { data: mockRow } = await (supabaseAdmin as any)
        .from("mock_accounts")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      const isMock = Boolean(mockRow?.user_id);

      const adminIsSuperAdmin = isSuperAdmin(admin);
      const isCreatorDeletingOwnMock =
        isMock && (targetUser as any).created_by_admin === (admin as any).id;

      if (!adminIsSuperAdmin && !isCreatorDeletingOwnMock) {
        return data({ error: "Only superadmins can delete users. Admins can delete only their own mock users." }, { status: 403 });
      }

      // Delete related data first (messages, conversations, listings, saved, etc.)
      await (supabaseAdmin.from("messages") as any).delete().eq("sender_id", userId);
      await (supabaseAdmin.from("saved_listings") as any).delete().eq("user_id", userId);
      await (supabaseAdmin.from("conversations") as any).delete().or(`participant_1.eq.${userId},participant_2.eq.${userId}`);
      await (supabaseAdmin.from("listings") as any).delete().eq("author_id", userId);
      await (supabaseAdmin.from("blocked_users") as any).delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
      await (supabaseAdmin.from("reports") as any).delete().eq("reporter_id", userId);
      await (supabaseAdmin.from("admin_audit_log") as any).delete().or(`target_user_id.eq.${userId},admin_id.eq.${userId}`);
      await (supabaseAdmin.from("tl_invite_tokens") as any).delete().or(`created_by.eq.${userId},used_by.eq.${userId}`);
      await (supabaseAdmin.from("referral_invites") as any).delete().or(`team_leader_id.eq.${userId},claimed_by.eq.${userId}`);

      // Delete profile
      const { error: profileDeleteError } = await (supabaseAdmin.from("profiles") as any).delete().eq("id", userId);
      if (profileDeleteError) {
        return data({ error: `Profile deletion failed: ${profileDeleteError.message}` }, { status: 500 });
      }

      // Delete auth user if exists (mock profiles may not have an auth account)
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authDeleteError && !isMock) {
        return data({ error: `Auth deletion failed: ${authDeleteError.message}` }, { status: 500 });
      }

      await logAdminAction((admin as any).id, "user_deleted", {
        targetUserId: userId,
      });

      return data({ success: true });
    }

    default:
      return data({ error: "Unknown action" }, { status: 400 });
  }
}

function getRowAccent(user: any) {
  if (user.user_type === "superadmin") return "bg-red-50/30";
  if (user.user_type === "admin") return "bg-purple-50/30";
  if (user.user_type === "team_leader") return "bg-indigo-50/30";
  if (user.user_type === "tour_operator") return "bg-blue-50/30";
  return "";
}

function getUserCategoryValue(user: any): UserCategory {
  if (user.user_type === "superadmin") return "superadmin";
  if (user.user_type === "admin") return "admin";
  if (user.user_type === "team_leader") return "team_leader";
  if (user.user_type === "tour_operator") return "tour_operator";
  return "private";
}

function getUserCategoryBadge(user: any) {
  if (user.user_type === "superadmin") {
    return { label: "Superadmin", className: "bg-red-100 text-red-700" };
  }
  if (user.user_type === "admin") {
    return { label: "Admin", className: "bg-purple-100 text-purple-700" };
  }
  if (user.user_type === "team_leader") {
    return { label: "Team Leader", className: "bg-indigo-100 text-indigo-700" };
  }
  if (user.user_type === "tour_operator") {
    return { label: "Tour Operator", className: "bg-blue-100 text-blue-700" };
  }
  return { label: "User", className: "bg-gray-100 text-gray-600" };
}

function formatDateStable(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export default function AdminUsers() {
  const { admin, users, totalCount, currentPage, totalPages, activeSegment, initialSearch } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const adminIsSuperAdmin = isSuperAdmin(admin);
  const adminId = (admin as any).id;
  const [searchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(initialSearch || "");
  const [searchOpen, setSearchOpen] = useState(false);

  const searchSuggestions = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return [];
    const seenUsers = new Set<string>();
    const seenSuggestionKeys = new Set<string>();
    const items: { value: string; label: string }[] = [];
    for (const user of users as any[]) {
      if (seenUsers.has(user.id)) continue;
      const name = String(user.full_name || "").trim();
      const email = String(user.email || "").trim();
      const nameMatch = Boolean(name) && name.toLowerCase().includes(q);
      const emailMatch = Boolean(email) && email.toLowerCase().includes(q);
      if (!nameMatch && !emailMatch) continue;

      seenUsers.add(user.id);
      const value = nameMatch ? name : email;
      const label = name && email ? `${name} - ${email}` : (name || email);
      const dedupeKey = `${value.toLowerCase()}|${label.toLowerCase()}`;
      if (seenSuggestionKeys.has(dedupeKey)) continue;
      seenSuggestionKeys.add(dedupeKey);
      items.push({
        value,
        label,
      });
      if (items.length >= 8) return items;
    }
    return items;
  }, [searchInput, users]);

  const segmentHref = (segmentId: SegmentId) => {
    const params = new URLSearchParams(searchParams);
    if (segmentId === "all") params.delete("segment");
    else params.set("segment", segmentId);
    params.set("page", "1");
    const query = params.toString();
    return query ? `/admin/users?${query}` : "/admin/users";
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 mt-1">{totalCount} total users</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <Link
            to="/admin/users/new"
            className="btn-primary rounded-full inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create User
          </Link>
        </div>
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
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => {
                setTimeout(() => setSearchOpen(false), 120);
              }}
              className="input w-full"
            />
            <input type="hidden" name="search" value={searchInput} />
            {searchOpen && searchSuggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                {searchSuggestions.map((item, idx) => (
                  <button
                    key={`${item.value}-${idx}`}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onMouseDown={() => {
                      setSearchInput(item.value);
                      setSearchOpen(false);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input type="hidden" name="segment" value={activeSegment} />
          <button type="submit" className="btn-accent rounded-full">
            Search
          </button>
        </Form>
        <div className="mt-3 flex flex-wrap gap-2">
          {SEGMENTS.map((segment) => (
            <Link
              key={segment.id}
              to={segmentHref(segment.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                activeSegment === segment.id
                  ? "bg-navy-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {segment.label}
            </Link>
          ))}
        </div>
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
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Verified</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Joined</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user: any) => (
                <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${getRowAccent(user)}`}>
                  <td className="px-6 py-4">
                    <Link to={`/admin/users/${getProfilePublicId(user)}`} className="block rounded-lg hover:bg-gray-50 -m-1 p-1">
                      <p className="text-sm font-medium text-gray-900">
                        {user.full_name || "No name"}
                      </p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                      {user.is_mock && (
                        <span className="mt-1 inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700">
                          Mock
                        </span>
                      )}
                      {user.company_name && (
                        <p className="text-xs text-gray-400">{user.company_name}</p>
                      )}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const badge = getUserCategoryBadge(user);
                      return (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      );
                    })()}
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
                    {formatDateStable(user.created_at)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 min-w-[320px]">
                      {user.created_by_admin ? (
                        <Form method="post" className="inline">
                          <input type="hidden" name="_action" value="impersonate" />
                          <input type="hidden" name="userId" value={user.id} />
                          <button
                            type="submit"
                            className="text-xs font-medium text-navy-500 hover:text-navy-700 px-2 py-1 rounded-full hover:bg-gray-100 transition-colors"
                            title="Impersonate this user"
                          >
                            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Impersonate
                          </button>
                        </Form>
                      ) : (
                        <span className="invisible px-2.5 py-1.5 text-xs font-medium">Impersonate</span>
                      )}

                      <details className="relative">
                        <summary className="list-none cursor-pointer text-xs font-medium px-2.5 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200">
                          Manage
                        </summary>
                        <div className="absolute right-0 mt-2 w-60 rounded-xl border border-gray-200 bg-white p-3 shadow-lg z-20 text-left">
                          <Form method="post" className="space-y-1">
                            <input type="hidden" name="_action" value="setCategory" />
                            <input type="hidden" name="userId" value={user.id} />
                            <label className="text-[11px] font-medium text-gray-500">Category</label>
                            <select
                              name="category"
                              defaultValue={getUserCategoryValue(user)}
                              className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700"
                              onChange={(e) => e.target.form?.requestSubmit()}
                            >
                              {(adminIsSuperAdmin
                                ? CATEGORY_OPTIONS
                                : CATEGORY_OPTIONS.filter((opt) => ["team_leader", "private"].includes(opt.value))
                              ).map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </Form>
                        </div>
                      </details>

                      {(adminIsSuperAdmin || (user.is_mock && user.created_by_admin === adminId)) && user.id !== adminId ? (
                        <Form method="post" className="inline" onSubmit={(e) => { if (!confirm(`Delete ${user.full_name || user.email}? This cannot be undone.`)) e.preventDefault(); }}>
                          <input type="hidden" name="_action" value="deleteUser" />
                          <input type="hidden" name="userId" value={user.id} />
                          <button
                            type="submit"
                            className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded-full hover:bg-red-50 transition-colors"
                            title="Delete this user"
                          >
                            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </Form>
                      ) : (
                        <span className="invisible px-2 py-1 text-xs font-medium">Delete</span>
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
            <div key={user.id} className={`p-4 ${getRowAccent(user)}`}>
              <div className="flex items-start justify-between mb-2">
                <Link to={`/admin/users/${getProfilePublicId(user)}`} className="block min-w-0 pr-2">
                  <p className="text-sm font-medium text-gray-900">{user.full_name || "No name"}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                  {user.is_mock && (
                    <span className="mt-1 inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700">
                      Mock
                    </span>
                  )}
                  {user.company_name && (
                    <p className="text-xs text-gray-400">{user.company_name}</p>
                  )}
                </Link>
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  {(() => {
                    const badge = getUserCategoryBadge(user);
                    return (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{getUserCategoryBadge(user).label}</span>
                  <span>·</span>
                  <span>{formatDateStable(user.created_at)}</span>
                  {user.is_verified && (
                    <>
                      <span>·</span>
                      <span className="text-brand-600">Verified</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <Form method="post" className="inline">
                    <input type="hidden" name="_action" value="verify" />
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="currentStatus" value={user.is_verified.toString()} />
                    <button type="submit" className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-full bg-gray-50">
                      {user.is_verified ? "Unverify" : "Verify"}
                    </button>
                  </Form>
                  {user.created_by_admin ? (
                    <Form method="post" className="inline">
                      <input type="hidden" name="_action" value="impersonate" />
                      <input type="hidden" name="userId" value={user.id} />
                      <button type="submit" className="text-xs text-navy-500 hover:text-navy-700 px-2 py-1 rounded-full bg-gray-50">
                        Impersonate
                      </button>
                    </Form>
                  ) : (
                    <span className="invisible text-xs px-2 py-1">Impersonate</span>
                  )}
                  <details className="relative inline-block">
                    <summary className="list-none cursor-pointer text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      Manage
                    </summary>
                    <div className="absolute right-0 mt-2 w-52 rounded-xl border border-gray-200 bg-white p-2 shadow-lg z-20">
                      <Form method="post" className="space-y-1">
                        <input type="hidden" name="_action" value="setCategory" />
                        <input type="hidden" name="userId" value={user.id} />
                        <label className="text-[11px] font-medium text-gray-500">Category</label>
                        <select
                          name="category"
                          defaultValue={getUserCategoryValue(user)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700"
                          onChange={(e) => e.target.form?.requestSubmit()}
                        >
                          {(adminIsSuperAdmin
                            ? CATEGORY_OPTIONS
                            : CATEGORY_OPTIONS.filter((opt) => ["team_leader", "private"].includes(opt.value))
                          ).map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </Form>
                    </div>
                  </details>
                  {(adminIsSuperAdmin || (user.is_mock && user.created_by_admin === adminId)) && user.id !== adminId ? (
                    <Form method="post" className="inline" onSubmit={(e) => { if (!confirm(`Delete ${user.full_name || user.email}?`)) e.preventDefault(); }}>
                      <input type="hidden" name="_action" value="deleteUser" />
                      <input type="hidden" name="userId" value={user.id} />
                      <button type="submit" className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-full bg-red-50">
                        Delete
                      </button>
                    </Form>
                  ) : (
                    <span className="invisible text-xs px-2 py-1">Delete</span>
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
              to={`/admin/users?page=${currentPage - 1}&search=${searchParams.get("search") || ""}&segment=${searchParams.get("segment") || ""}`}
              className="px-3 py-2 text-sm rounded-full border border-gray-200 hover:bg-gray-50"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              to={`/admin/users?page=${currentPage + 1}&search=${searchParams.get("search") || ""}&segment=${searchParams.get("segment") || ""}`}
              className="px-3 py-2 text-sm rounded-full border border-gray-200 hover:bg-gray-50"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
