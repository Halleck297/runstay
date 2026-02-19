// app/routes/admin._index.tsx - Admin Dashboard
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export const meta: MetaFunction = () => {
  return [{ title: "Admin Dashboard - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const admin = await requireAdmin(request);

  // Fetch all stats in parallel
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalUsers },
    { count: newUsersWeek },
    { count: newUsersMonth },
    { count: totalListings },
    { count: activeListings },
    { count: soldListings },
    { count: expiredListings },
    { count: totalMessages },
    { count: totalConversations },
    { count: privateUsers },
    { count: tourOperators },
    { count: roomListings },
    { count: bibListings },
    { count: packageListings },
    { count: totalTeamLeaders },
    { count: totalReferrals },
    { count: pendingListings },
    { data: recentUsers },
    { data: recentListings },
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
    supabaseAdmin.from("listings").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("listings").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabaseAdmin.from("listings").select("*", { count: "exact", head: true }).eq("status", "sold"),
    supabaseAdmin.from("listings").select("*", { count: "exact", head: true }).eq("status", "expired"),
    supabaseAdmin.from("messages").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("conversations").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("user_type", "private"),
    supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("user_type", "tour_operator"),
    supabaseAdmin.from("listings").select("*", { count: "exact", head: true }).eq("listing_type", "room"),
    supabaseAdmin.from("listings").select("*", { count: "exact", head: true }).eq("listing_type", "bib"),
    supabaseAdmin.from("listings").select("*", { count: "exact", head: true }).eq("listing_type", "room_and_bib"),
    supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("is_team_leader", true),
    supabaseAdmin.from("referrals").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("listings").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabaseAdmin.from("profiles").select("id, full_name, email, user_type, role, is_verified, is_team_leader, created_at").order("created_at", { ascending: false }).limit(10),
    supabaseAdmin.from("listings").select(`id, title, listing_type, status, created_at, author:profiles(full_name, email, company_name)`).order("created_at", { ascending: false }).limit(10),
  ]);

  return {
    stats: {
      totalUsers: totalUsers || 0,
      newUsersWeek: newUsersWeek || 0,
      newUsersMonth: newUsersMonth || 0,
      totalListings: totalListings || 0,
      activeListings: activeListings || 0,
      soldListings: soldListings || 0,
      expiredListings: expiredListings || 0,
      totalMessages: totalMessages || 0,
      totalConversations: totalConversations || 0,
      privateUsers: privateUsers || 0,
      tourOperators: tourOperators || 0,
      roomListings: roomListings || 0,
      bibListings: bibListings || 0,
      packageListings: packageListings || 0,
      totalTeamLeaders: totalTeamLeaders || 0,
      totalReferrals: totalReferrals || 0,
      pendingListings: pendingListings || 0,
    },
    recentUsers: recentUsers || [],
    recentListings: recentListings || [],
  };
}

// Simple CSS bar chart component
function BarChart({ items }: { items: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">{item.label}</span>
            <span className="font-semibold text-gray-900">{item.value}</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${item.color}`}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const listingTypeLabels: Record<string, string> = {
  room: "Hotel",
  bib: "Bib",
  room_and_bib: "Package",
};

const statusColors: Record<string, string> = {
  active: "bg-success-100 text-success-700",
  sold: "bg-gray-100 text-gray-600",
  expired: "bg-alert-100 text-alert-700",
};

export default function AdminDashboard() {
  const { stats, recentUsers, recentListings } = useLoaderData<typeof loader>();

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-900">
          Dashboard
        </h1>
        <p className="text-gray-500 mt-1">Platform overview and statistics</p>
      </div>

      {/* Stats cards */}
      {/* Pending alert banner */}
      {stats.pendingListings > 0 && (
        <Link to="/admin/pending" className="block mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 hover:bg-yellow-100 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-yellow-800">
                {stats.pendingListings} listing{stats.pendingListings > 1 ? "s" : ""} pending review
              </p>
              <p className="text-xs text-yellow-600">Click to review and approve</p>
            </div>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Users" value={stats.totalUsers} icon="users" color="brand" />
        <StatCard label="New (7d)" value={stats.newUsersWeek} icon="trending" color="success" />
        <StatCard label="Active Listings" value={stats.activeListings} icon="listings" color="accent" />
        <StatCard label="Messages" value={stats.totalMessages} icon="messages" color="blue" />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-xs text-gray-500 uppercase tracking-wide">New (30d)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.newUsersMonth}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Listings</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalListings}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Sold</p>
          <p className="text-2xl font-bold text-success-600 mt-1">{stats.soldListings}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Conversations</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalConversations}</p>
        </div>
      </div>

      {/* Team Leader stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalTeamLeaders}</p>
              <p className="text-xs text-gray-500">Team Leaders</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalReferrals}</p>
              <p className="text-xs text-gray-500">Total Referrals</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts section */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Users by type */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="font-display font-semibold text-gray-900 mb-4">Users by Type</h2>
          <BarChart
            items={[
              { label: "Private Runners", value: stats.privateUsers, color: "bg-brand-500" },
              { label: "Tour Operators", value: stats.tourOperators, color: "bg-accent-500" },
            ]}
          />
        </div>

        {/* Listings by type */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="font-display font-semibold text-gray-900 mb-4">Listings by Type</h2>
          <BarChart
            items={[
              { label: "Hotel Rooms", value: stats.roomListings, color: "bg-blue-500" },
              { label: "Bibs", value: stats.bibListings, color: "bg-purple-500" },
              { label: "Packages", value: stats.packageListings, color: "bg-success-500" },
            ]}
          />
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent users */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-display font-semibold text-gray-900">Recent Users</h2>
            <a href="/admin/users" className="text-sm text-brand-600 font-medium hover:text-brand-700">
              View all
            </a>
          </div>
          <div className="divide-y divide-gray-100">
            {recentUsers.length > 0 ? (
              recentUsers.map((user: any) => (
                <div key={user.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.full_name || user.email}
                    </p>
                    <p className="text-xs text-gray-500">
                      {user.user_type === "tour_operator" ? "TO" : "Runner"} · {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.is_verified && (
                      <span className="text-brand-500">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                    {user.is_team_leader && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-600">
                        TL
                      </span>
                    )}
                    {user.role !== "user" && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        {user.role}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">No users yet</div>
            )}
          </div>
        </div>

        {/* Recent listings */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-display font-semibold text-gray-900">Recent Listings</h2>
            <a href="/admin/listings" className="text-sm text-brand-600 font-medium hover:text-brand-700">
              View all
            </a>
          </div>
          <div className="divide-y divide-gray-100">
            {recentListings.length > 0 ? (
              recentListings.map((listing: any) => (
                <div key={listing.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {listing.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      by {listing.author?.company_name || listing.author?.full_name || listing.author?.email || "Unknown"} · {new Date(listing.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {listingTypeLabels[listing.listing_type] || listing.listing_type}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[listing.status] || ""}`}>
                      {listing.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">No listings yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat card component
function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  const colorClasses: Record<string, { bg: string; iconBg: string; iconText: string }> = {
    brand: { bg: "bg-white", iconBg: "bg-brand-100", iconText: "text-brand-600" },
    success: { bg: "bg-white", iconBg: "bg-success-100", iconText: "text-success-600" },
    accent: { bg: "bg-white", iconBg: "bg-accent-100", iconText: "text-accent-600" },
    blue: { bg: "bg-white", iconBg: "bg-blue-100", iconText: "text-blue-600" },
  };

  const icons: Record<string, JSX.Element> = {
    users: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    trending: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    listings: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    messages: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  };

  const c = colorClasses[color] || colorClasses.brand;

  return (
    <div className={`${c.bg} rounded-xl p-4 md:p-6 border border-gray-200 shadow-sm`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${c.iconBg} flex items-center justify-center ${c.iconText}`}>
          {icons[icon]}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
