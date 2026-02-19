// app/routes/tl-dashboard.tsx - Team Leader Dashboard
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { useLoaderData, useActionData, Form } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { useState } from "react";

export const meta: MetaFunction = () => {
  return [{ title: "Team Leader Dashboard - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  if (!(user as any).is_team_leader) {
    throw redirect("/dashboard");
  }

  // Fetch referrals with user details
  const { data: referrals } = await supabaseAdmin
    .from("referrals")
    .select("id, referral_code_used, status, created_at, referred_user_id")
    .eq("team_leader_id", (user as any).id)
    .order("created_at", { ascending: false });

  // Fetch referred users' profiles
  const referralIds = (referrals || []).map((r: any) => r.referred_user_id);
  let referredUsers: Record<string, any> = {};
  if (referralIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, user_type, is_verified, created_at")
      .in("id", referralIds);

    if (profiles) {
      for (const p of profiles as any[]) {
        referredUsers[p.id] = p;
      }
    }
  }

  // Stats
  const totalReferrals = referrals?.length || 0;
  const activeReferrals = referrals?.filter((r: any) => r.status === "active").length || 0;

  // Weekly breakdown (last 4 weeks)
  const weeklyData = [];
  for (let i = 3; i >= 0; i--) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() - i * 7);

    const count = (referrals || []).filter((r: any) => {
      const d = new Date(r.created_at);
      return d >= weekStart && d < weekEnd;
    }).length;

    weeklyData.push({
      label: i === 0 ? "This week" : `${i}w ago`,
      value: count,
    });
  }

  return {
    user,
    referrals: referrals || [],
    referredUsers,
    stats: {
      totalReferrals,
      activeReferrals,
    },
    weeklyData,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);

  if (!(user as any).is_team_leader) {
    return data({ error: "Not a team leader" }, { status: 403 });
  }

  const formData = await request.formData();
  const actionType = formData.get("_action") as string;

  switch (actionType) {
    case "updateCode": {
      const newCode = (formData.get("referralCode") as string || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

      if (newCode.length < 3 || newCode.length > 20) {
        return data({ error: "Code must be between 3 and 20 characters (letters and numbers only)" }, { status: 400 });
      }

      // Check uniqueness
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("referral_code", newCode)
        .neq("id", (user as any).id)
        .single();

      if (existing) {
        return data({ error: "This code is already taken. Try a different one." }, { status: 400 });
      }

      await (supabaseAdmin.from("profiles") as any)
        .update({ referral_code: newCode })
        .eq("id", (user as any).id);

      return data({ success: true, message: "Referral code updated!" });
    }

    case "updateWelcome": {
      const welcomeMessage = (formData.get("welcomeMessage") as string || "").trim();

      if (welcomeMessage.length > 500) {
        return data({ error: "Welcome message must be under 500 characters" }, { status: 400 });
      }

      await (supabaseAdmin.from("profiles") as any)
        .update({ tl_welcome_message: welcomeMessage || null })
        .eq("id", (user as any).id);

      return data({ success: true, message: "Welcome message updated!" });
    }

    default:
      return data({ error: "Unknown action" }, { status: 400 });
  }
}

const userTypeLabels: Record<string, string> = {
  tour_operator: "Tour Operator",
  private: "Runner",
};

export default function TLDashboard() {
  const { user, referrals, referredUsers, stats, weeklyData } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const referralLink = `${baseUrl}/join/${(user as any).referral_code}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maxWeekly = Math.max(...weeklyData.map((w: any) => w.value), 1);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-900">
              Team Leader Dashboard
            </h1>
            <p className="text-gray-500">Manage your referral community</p>
          </div>
        </div>
      </div>

      {/* Action feedback */}
      {actionData && "error" in actionData && (
        <div className="mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm">
          {(actionData as any).error}
        </div>
      )}
      {actionData && "message" in actionData && (
        <div className="mb-4 p-3 rounded-lg bg-success-50 text-success-700 text-sm">
          {(actionData as any).message}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Referrals</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalReferrals}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Active</p>
          <p className="text-3xl font-bold text-brand-600 mt-1">{stats.activeReferrals}</p>
        </div>
      </div>

      {/* Weekly chart */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-6">
        <h2 className="font-display font-semibold text-gray-900 mb-4">Weekly Signups</h2>
        <div className="flex items-end gap-3 h-32">
          {weeklyData.map((week: any, i: number) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-semibold text-gray-900">{week.value}</span>
              <div
                className="w-full bg-brand-500 rounded-t-md transition-all duration-500"
                style={{
                  height: `${Math.max((week.value / maxWeekly) * 100, 4)}%`,
                  minHeight: "4px",
                }}
              />
              <span className="text-xs text-gray-500 mt-1">{week.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Referral Link */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-6">
        <h2 className="font-display font-semibold text-gray-900 mb-2">Your Referral Link</h2>
        <p className="text-sm text-gray-500 mb-4">Share this link with people you want to invite to Runoot.</p>

        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 bg-gray-50 rounded-lg px-4 py-2.5 font-mono text-sm text-gray-700 border border-gray-200 truncate">
            {referralLink}
          </div>
          <button
            onClick={copyLink}
            className="btn-primary text-sm px-4 py-2.5 flex-shrink-0"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        {/* Customize code */}
        <Form method="post" className="flex items-end gap-3">
          <input type="hidden" name="_action" value="updateCode" />
          <div className="flex-1">
            <label htmlFor="referralCode" className="label">Custom Code</label>
            <div className="flex items-center">
              <span className="text-sm text-gray-400 mr-1">/join/</span>
              <input
                type="text"
                id="referralCode"
                name="referralCode"
                defaultValue={(user as any).referral_code || ""}
                placeholder="MYCODE2026"
                className="input flex-1 uppercase"
                maxLength={20}
              />
            </div>
          </div>
          <button type="submit" className="btn-secondary text-sm px-4 py-2">
            Save Code
          </button>
        </Form>
      </div>

      {/* Welcome message */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-6">
        <h2 className="font-display font-semibold text-gray-900 mb-2">Welcome Message</h2>
        <p className="text-sm text-gray-500 mb-4">
          This message will appear on your referral page when someone opens your link.
        </p>
        <Form method="post">
          <input type="hidden" name="_action" value="updateWelcome" />
          <textarea
            name="welcomeMessage"
            rows={3}
            defaultValue={(user as any).tl_welcome_message || ""}
            placeholder="Welcome to our running community! I'm excited to have you join us on Runoot..."
            className="input w-full mb-3"
            maxLength={500}
          />
          <button type="submit" className="btn-secondary text-sm">
            Save Message
          </button>
        </Form>
      </div>

      {/* Referrals list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-display font-semibold text-gray-900">Your Referrals</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {referrals.length > 0 ? (
            referrals.map((ref: any) => {
              const refUser = referredUsers[ref.referred_user_id];
              return (
                <div key={ref.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold flex-shrink-0 text-sm">
                      {refUser?.full_name?.charAt(0) || refUser?.email?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {refUser?.full_name || refUser?.email || "Unknown user"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">
                          {refUser ? userTypeLabels[refUser.user_type] || refUser.user_type : ""}
                        </span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-500">
                          {new Date(ref.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                      ref.status === "active"
                        ? "bg-success-100 text-success-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {ref.status}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-sm text-gray-500 mb-1">No referrals yet</p>
              <p className="text-xs text-gray-400">Share your referral link to start growing your community!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
