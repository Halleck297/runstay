// app/routes/admin.team-leaders.$id.tsx - Admin: Team Leader Detail View
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export const meta: MetaFunction<typeof loader> = ({ data: loaderData }) => {
  const d = loaderData as any;
  const name = d?.profile?.full_name || "Team Leader";
  return [{ title: `${name} - Team Leaders - Admin - Runoot` }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const tlId = params.id;
  if (!tlId) throw data({ error: "Missing ID" }, { status: 400 });

  // Fetch TL profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, company_name, user_type, is_verified, referral_code, phone, country, city, date_of_birth, preferred_language, avatar_url, tl_welcome_message, created_at, updated_at, created_by_admin")
    .eq("id", tlId)
    .single();

  if (profileError || !profile) {
    throw data({ error: "Team Leader not found" }, { status: 404 });
  }

  // Fetch referrals with referred user profiles
  const { data: referrals } = await (supabaseAdmin as any)
    .from("referrals")
    .select("id, referral_code_used, status, created_at, referred_user_id, referred_user:profiles!referrals_referred_user_id_fkey(id, full_name, email, user_type, is_verified, created_at, avatar_url)")
    .eq("team_leader_id", tlId)
    .neq("referred_user_id", tlId)
    .order("created_at", { ascending: false });

  // Fetch all referral invites
  const { data: invites } = await (supabaseAdmin.from("referral_invites") as any)
    .select("id, email, status, invite_type, created_at, claimed_at, claimed_by, updated_at, expires_at")
    .eq("team_leader_id", tlId)
    .order("created_at", { ascending: false });

  // Stats
  const allReferrals = referrals || [];
  const allInvites = invites || [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const totalInvitesSent = allInvites.length;
  const invitesPending = allInvites.filter((i: any) => i.status === "pending").length;
  const invitesAccepted = allInvites.filter((i: any) => i.status === "accepted").length;
  const totalReferrals = allReferrals.length;
  const newLast30Days = allReferrals.filter((r: any) => new Date(r.created_at) >= thirtyDaysAgo).length;
  const conversionRate = totalInvitesSent > 0 ? Math.round((invitesAccepted / totalInvitesSent) * 100) : 0;

  // Team activity stats (listings, conversations, saved)
  const referralIds = allReferrals.map((r: any) => r.referred_user_id).filter(Boolean);
  let teamListings = 0;
  let teamConversations = 0;
  let teamSaved = 0;

  if (referralIds.length > 0) {
    const [{ count: listingsCount }, { count: savedCount }] = await Promise.all([
      (supabaseAdmin.from("listings") as any)
        .select("id", { count: "exact", head: true })
        .in("author_id", referralIds),
      (supabaseAdmin.from("saved_listings") as any)
        .select("id", { count: "exact", head: true })
        .in("user_id", referralIds),
    ]);
    teamListings = listingsCount || 0;
    teamSaved = savedCount || 0;

    const [convAsP1, convAsP2] = await Promise.all([
      (supabaseAdmin.from("conversations") as any).select("id").in("participant_1", referralIds),
      (supabaseAdmin.from("conversations") as any).select("id").in("participant_2", referralIds),
    ]);
    const uniqueConvIds = new Set([...(convAsP1.data || []), ...(convAsP2.data || [])].map((c: any) => c.id));
    teamConversations = uniqueConvIds.size;
  }

  // Check who created this TL (if created by admin)
  let createdByAdmin: { full_name: string; email: string } | null = null;
  if ((profile as any).created_by_admin) {
    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", (profile as any).created_by_admin)
      .single();
    if (adminProfile) createdByAdmin = adminProfile as any;
  }

  return {
    profile,
    referrals: allReferrals,
    invites: allInvites,
    createdByAdmin,
    stats: {
      totalInvitesSent,
      invitesPending,
      invitesAccepted,
      totalReferrals,
      newLast30Days,
      conversionRate,
      teamListings,
      teamConversations,
      teamSaved,
    },
  };
}

export default function AdminTeamLeaderDetail() {
  const { profile, referrals, invites, createdByAdmin, stats } = useLoaderData<typeof loader>();
  const tl = profile as any;

  return (
    <div>
      {/* Back link + header */}
      <div className="mb-6">
        <Link
          to="/admin/team-leaders"
          className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 mb-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Team Leaders
        </Link>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-900">
          {tl.full_name || "Team Leader"}
        </h1>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-xl flex-shrink-0">
            {tl.avatar_url ? (
              <img src={tl.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              tl.full_name?.charAt(0)?.toUpperCase() || "T"
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-lg font-semibold text-gray-900">{tl.full_name}</h2>
              {tl.is_verified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-700">
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Verified
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                Team Leader
              </span>
            </div>
            {tl.company_name && (
              <p className="text-sm text-gray-600 mt-0.5">{tl.company_name}</p>
            )}

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
              <Detail label="Email" value={tl.email} />
              <Detail label="Phone" value={tl.phone || "—"} />
              <Detail label="Country" value={tl.country || "—"} />
              <Detail label="City" value={tl.city || "—"} />
              <Detail label="Language" value={tl.preferred_language?.toUpperCase() || "—"} />
              <Detail label="Date of birth" value={tl.date_of_birth || "—"} />
              <Detail label="Referral code" value={tl.referral_code ? `/${tl.referral_code}` : "—"} mono />
              <Detail
                label="Registered"
                value={new Date(tl.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              />
            </div>

            {createdByAdmin && (
              <p className="mt-2 text-xs text-gray-400">
                Created by admin: {createdByAdmin.full_name || createdByAdmin.email}
              </p>
            )}

            {tl.tl_welcome_message && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Welcome message</p>
                <p className="text-sm text-gray-700 italic">"{tl.tl_welcome_message}"</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Invites Sent" value={stats.totalInvitesSent} color="purple" />
        <StatCard label="Registered" value={stats.invitesAccepted} color="green" />
        <StatCard label="Pending" value={stats.invitesPending} color="amber" />
        <StatCard label="Conversion" value={`${stats.conversionRate}%`} color="brand" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Referrals" value={stats.totalReferrals} color="brand" />
        <StatCard label="New (30d)" value={stats.newLast30Days} color="blue" />
        <StatCard label="Team Listings" value={stats.teamListings} color="purple" />
        <StatCard label="Team Conversations" value={stats.teamConversations} color="gray" />
      </div>

      {/* Invites sent */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-gray-900">Invites Sent</h2>
          <span className="text-xs text-gray-500">{invites.length} total</span>
        </div>
        {invites.length > 0 ? (
          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {(invites as any[]).map((invite) => (
              <div key={invite.id} className="px-6 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900 truncate">{invite.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Sent {new Date(invite.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    {invite.claimed_at && (
                      <> &middot; Accepted {new Date(invite.claimed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</>
                    )}
                  </p>
                </div>
                <InviteStatusBadge status={invite.status} expiresAt={invite.expires_at} />
              </div>
            ))}
          </div>
        ) : (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">No invites sent yet.</p>
        )}
      </div>

      {/* Referred runners */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-gray-900">Referred Runners</h2>
          <span className="text-xs text-gray-500">{referrals.length} total</span>
        </div>
        {referrals.length > 0 ? (
          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {(referrals as any[]).map((ref) => {
              const runner = ref.referred_user;
              return (
                <div key={ref.id} className="px-6 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm flex-shrink-0">
                      {runner?.avatar_url ? (
                        <img src={runner.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        runner?.full_name?.charAt(0)?.toUpperCase() || "?"
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {runner?.full_name || "Unknown"}
                        {runner?.is_verified && (
                          <svg className="inline-block ml-1 h-3.5 w-3.5 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {runner?.email || "—"}
                        <span className="text-gray-300 mx-1">&middot;</span>
                        {runner?.user_type || "private"}
                        <span className="text-gray-300 mx-1">&middot;</span>
                        Joined {new Date(ref.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    ref.status === "active"
                      ? "bg-success-100 text-success-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {ref.status}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">No referred runners yet.</p>
        )}
      </div>
    </div>
  );
}

// ---- Helper components ----

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-gray-500 whitespace-nowrap">{label}:</span>
      <span className={`text-sm text-gray-900 truncate ${mono ? "font-mono text-purple-600" : ""}`}>{value}</span>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700 border-brand-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    green: "bg-success-50 text-success-700 border-success-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
  };
  const classes = colorMap[color] || colorMap.gray;

  return (
    <div className={`rounded-xl border p-4 ${classes}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-1 opacity-80">{label}</p>
    </div>
  );
}

function InviteStatusBadge({ status, expiresAt }: { status: string; expiresAt?: string }) {
  if (status === "accepted") {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-700">Accepted</span>;
  }
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Expired</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Pending</span>;
}
