// app/routes/admin.team-leaders.tsx - Admin: Team Leaders Management
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { useLoaderData, useActionData, Form } from "react-router";
import { requireAdmin, logAdminAction } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { useState } from "react";

export const meta: MetaFunction = () => {
  return [{ title: "Team Leaders - Admin - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const admin = await requireAdmin(request);

  // Fetch TLs with their referral counts
  const { data: teamLeaders } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, company_name, user_type, is_verified, is_team_leader, referral_code, created_at")
    .eq("is_team_leader", true)
    .order("created_at", { ascending: false });

  // Fetch referral counts per TL
  const tlIds = (teamLeaders || []).map((tl: any) => tl.id);
  let referralCounts: Record<string, number> = {};
  if (tlIds.length > 0) {
    const { data: counts } = await supabaseAdmin
      .from("referrals")
      .select("team_leader_id")
      .in("team_leader_id", tlIds);

    if (counts) {
      for (const row of counts as any[]) {
        referralCounts[row.team_leader_id] = (referralCounts[row.team_leader_id] || 0) + 1;
      }
    }
  }

  // Fetch active invite tokens
  const { data: tokens } = await supabaseAdmin
    .from("tl_invite_tokens")
    .select("id, token, created_by, used_by, used_at, expires_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  // Summary stats
  const { count: totalTLs } = await supabaseAdmin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_team_leader", true);

  const { count: totalReferrals } = await supabaseAdmin
    .from("referrals")
    .select("*", { count: "exact", head: true });

  return {
    admin,
    teamLeaders: teamLeaders || [],
    referralCounts,
    tokens: tokens || [],
    stats: {
      totalTLs: totalTLs || 0,
      totalReferrals: totalReferrals || 0,
    },
  };
}

function generateToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let token = "";
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function generateReferralCode(name: string): string {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 8);
  const year = new Date().getFullYear();
  return `${base}${year}`;
}

export async function action({ request }: ActionFunctionArgs) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const actionType = formData.get("_action") as string;

  switch (actionType) {
    case "generateToken": {
      const token = generateToken();
      const expiresInDays = 30;
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await (supabaseAdmin.from("tl_invite_tokens") as any).insert({
        token,
        created_by: (admin as any).id,
        expires_at: expiresAt,
      });

      if (error) {
        return data({ error: `Failed to generate token: ${error.message}` }, { status: 500 });
      }

      await logAdminAction((admin as any).id, "tl_token_generated", {
        details: { token },
      });

      return data({ success: true, token, message: "Invite token generated!" });
    }

    case "toggleTeamLeader": {
      const userId = formData.get("userId") as string;
      const currentStatus = formData.get("currentStatus") === "true";
      const newStatus = !currentStatus;

      // If promoting to TL, generate a referral code
      let updateData: any = { is_team_leader: newStatus };
      if (newStatus) {
        // Generate referral code from user name
        const { data: userProfile } = await supabaseAdmin
          .from("profiles")
          .select("full_name, email")
          .eq("id", userId)
          .single();

        const baseName = (userProfile as any)?.full_name || (userProfile as any)?.email?.split("@")[0] || "TL";
        let code = generateReferralCode(baseName);

        // Check if code already exists, add random suffix if so
        const { data: existing } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("referral_code", code)
          .single();

        if (existing) {
          code = code + Math.floor(Math.random() * 100);
        }

        updateData.referral_code = code;
      }

      const { error } = await (supabaseAdmin.from("profiles") as any)
        .update(updateData)
        .eq("id", userId);

      if (error) {
        return data({ error: `Failed to update: ${error.message}` }, { status: 500 });
      }

      await logAdminAction((admin as any).id, newStatus ? "tl_promoted" : "tl_demoted", {
        targetUserId: userId,
      });

      // Send notification if promoting
      if (newStatus) {
        await (supabaseAdmin.from("notifications") as any).insert({
          user_id: userId,
          type: "tl_promoted",
          title: "You're a Team Leader!",
          message: "An admin has promoted you to Team Leader. You can now share your referral link and manage your community from the TL Dashboard.",
          data: { referral_code: updateData.referral_code },
        });
      }

      return data({ success: true });
    }

    case "deleteToken": {
      const tokenId = formData.get("tokenId") as string;

      await (supabaseAdmin.from("tl_invite_tokens") as any)
        .delete()
        .eq("id", tokenId);

      return data({ success: true });
    }

    default:
      return data({ error: "Unknown action" }, { status: 400 });
  }
}

export default function AdminTeamLeaders() {
  const { teamLeaders, referralCounts, tokens, stats } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const copyToClipboard = (text: string, tokenId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(tokenId);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-900">Team Leaders</h1>
        <p className="text-gray-500 mt-1">Manage team leaders and invite tokens</p>
      </div>

      {/* Action feedback */}
      {actionData && "error" in actionData && (
        <div className="mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm">
          {(actionData as any).error}
        </div>
      )}
      {actionData && "token" in actionData && (
        <div className="mb-4 p-4 rounded-lg bg-success-50 border border-success-200">
          <p className="text-sm font-medium text-success-800 mb-2">Token generated!</p>
          <div className="flex items-center gap-2">
            <code className="text-sm bg-white px-3 py-1.5 rounded border border-success-200 font-mono flex-1 break-all">
              {baseUrl}/become-tl/{(actionData as any).token}
            </code>
            <button
              onClick={() => copyToClipboard(`${baseUrl}/become-tl/${(actionData as any).token}`, "new")}
              className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0"
            >
              {copiedToken === "new" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalTLs}</p>
              <p className="text-xs text-gray-500">Team Leaders</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
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

      {/* Generate Invite Token */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display font-semibold text-gray-900">Invite Tokens</h2>
            <p className="text-sm text-gray-500 mt-1">Generate links to invite someone to become a Team Leader</p>
          </div>
          <Form method="post">
            <input type="hidden" name="_action" value="generateToken" />
            <button type="submit" className="btn-primary text-sm inline-flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Generate Token
            </button>
          </Form>
        </div>

        {/* Active tokens list */}
        {tokens.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {tokens.map((token: any) => (
              <div key={token.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-gray-600 truncate">
                      {token.token}
                    </code>
                    {token.used_by ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-700">
                        Used
                      </span>
                    ) : token.expires_at && new Date(token.expires_at) < new Date() ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        Expired
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Created {new Date(token.created_at).toLocaleDateString()}
                    {token.expires_at && ` · Expires ${new Date(token.expires_at).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!token.used_by && (
                    <button
                      onClick={() => copyToClipboard(`${baseUrl}/become-tl/${token.token}`, token.id)}
                      className="text-xs text-brand-600 hover:text-brand-700 px-2 py-1 rounded bg-brand-50"
                    >
                      {copiedToken === token.id ? "Copied!" : "Copy Link"}
                    </button>
                  )}
                  <Form method="post" className="inline">
                    <input type="hidden" name="_action" value="deleteToken" />
                    <input type="hidden" name="tokenId" value={token.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </Form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            No invite tokens yet. Generate one to invite a Team Leader.
          </p>
        )}
      </div>

      {/* Team Leaders list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-display font-semibold text-gray-900">Active Team Leaders</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {teamLeaders.length > 0 ? (
            teamLeaders.map((tl: any) => (
              <div key={tl.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold flex-shrink-0">
                    {tl.full_name?.charAt(0) || tl.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {tl.full_name || "No name"}
                      {tl.company_name && (
                        <span className="text-gray-400 font-normal"> · {tl.company_name}</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500">{tl.email}</span>
                      {tl.referral_code && (
                        <>
                          <span className="text-xs text-gray-300">·</span>
                          <span className="text-xs font-mono text-purple-600">/{tl.referral_code}</span>
                        </>
                      )}
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-brand-600 font-medium">
                        {referralCounts[tl.id] || 0} referrals
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {tl.referral_code && (
                    <button
                      onClick={() => copyToClipboard(`${baseUrl}/join/${tl.referral_code}`, `tl-${tl.id}`)}
                      className="text-xs text-brand-600 hover:text-brand-700 px-2 py-1 rounded bg-brand-50"
                    >
                      {copiedToken === `tl-${tl.id}` ? "Copied!" : "Copy Referral"}
                    </button>
                  )}
                  <Form method="post" className="inline">
                    <input type="hidden" name="_action" value="toggleTeamLeader" />
                    <input type="hidden" name="userId" value={tl.id} />
                    <input type="hidden" name="currentStatus" value="true" />
                    <button
                      type="submit"
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                      onClick={(e) => {
                        if (!confirm(`Remove Team Leader status from ${tl.full_name || tl.email}?`)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      Remove TL
                    </button>
                  </Form>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-400 text-sm">
              No team leaders yet. Promote users from the{" "}
              <a href="/admin/users" className="text-brand-600 hover:underline">Users page</a>{" "}
              or generate an invite token above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
