// app/routes/tl-dashboard.tsx - Team Leader Dashboard
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { useLoaderData, useActionData, Form } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { useState } from "react";
import { Header } from "~/components/Header";
import { sendTemplatedEmail } from "~/lib/email/service.server";

const MAX_BATCH_INVITES = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[“”‘’\"'`]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

export const meta: MetaFunction = () => {
  return [{ title: "Team Leader Dashboard - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");

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

  const { data: reservedEmails } = await (supabaseAdmin.from("referral_invites") as any)
    .select("id, email, status, created_at, claimed_at")
    .eq("team_leader_id", (user as any).id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Stats
  const totalReferrals = referrals?.length || 0;
  const activeReferrals = referrals?.filter((r: any) => r.status === "active").length || 0;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const newInLast30Days = (referrals || []).filter((r: any) => new Date(r.created_at) >= thirtyDaysAgo).length;

  // Weekly breakdown (last 8 weeks): new signups + cumulative total
  const weeklyData = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - (i + 1) * 7);

    const weekEnd = new Date();
    weekEnd.setHours(0, 0, 0, 0);
    weekEnd.setDate(weekEnd.getDate() - i * 7);

    const newSignups = (referrals || []).filter((r: any) => {
      const d = new Date(r.created_at);
      return d >= weekStart && d < weekEnd;
    }).length;

    const cumulative = (referrals || []).filter((r: any) => {
      const d = new Date(r.created_at);
      return d < weekEnd;
    }).length;

    weeklyData.push({
      label: i === 0 ? "This week" : `${i}w ago`,
      newSignups,
      cumulative,
    });
  }

  return {
    user,
    appUrl,
    referrals: referrals || [],
    referredUsers,
    reservedEmails: reservedEmails || [],
    stats: {
      totalReferrals,
      activeReferrals,
      newInLast30Days,
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

    case "sendInvites": {
      const rawEmails = Array.from(formData.entries())
        .filter(([key]) => key.startsWith("inviteEmail"))
        .map(([, value]) => normalizeEmail(String(value || "")))
        .filter(Boolean);

      const emails = Array.from(new Set(rawEmails));

      if (emails.length === 0) {
        return data({ error: "Add at least one email." }, { status: 400 });
      }

      if (emails.length > MAX_BATCH_INVITES) {
        return data({ error: `You can send up to ${MAX_BATCH_INVITES} invitations at once.` }, { status: 400 });
      }

      const invalidEmails = emails.filter((email) => !EMAIL_PATTERN.test(email));
      if (invalidEmails.length > 0) {
        return data({ error: `Invalid email format: ${invalidEmails.join(", ")}` }, { status: 400 });
      }

      if (!(user as any).referral_code) {
        return data({ error: "Missing referral code. Save your referral code first." }, { status: 400 });
      }

      const now = new Date().toISOString();
      const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
      const referralLink = `${appUrl}/join/${(user as any).referral_code}`;

      const { data: existingInvites } = await (supabaseAdmin.from("referral_invites") as any)
        .select("id, email, team_leader_id, status")
        .in("email", emails);

      const invitesByEmail = new Map<string, any>();
      for (const invite of (existingInvites || [])) {
        invitesByEmail.set(normalizeEmail(invite.email), invite);
      }

      const { data: matchedProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name")
        .in("email", emails);

      const profilesByEmail = new Map<string, any>();
      for (const profile of (matchedProfiles || [])) {
        profilesByEmail.set(normalizeEmail(profile.email), profile);
      }

      const profileIds = (matchedProfiles || []).map((p: any) => p.id);
      const referralsByUserId = new Map<string, any>();
      if (profileIds.length > 0) {
        const { data: existingReferrals } = await supabaseAdmin
          .from("referrals")
          .select("id, referred_user_id, team_leader_id")
          .in("referred_user_id", profileIds);

        for (const referral of (existingReferrals || [])) {
          referralsByUserId.set(referral.referred_user_id, referral);
        }
      }

      let sentEmails = 0;
      let autoLinked = 0;
      const skipped: string[] = [];
      const warnings: string[] = [];

      for (const email of emails) {
        const invite = invitesByEmail.get(email);
        const existingProfile = profilesByEmail.get(email);
        const existingReferral = existingProfile ? referralsByUserId.get(existingProfile.id) : null;

        if (invite && invite.team_leader_id !== (user as any).id) {
          skipped.push(`${email} (already reserved by another TL)`);
          continue;
        }

        if (existingReferral && existingReferral.team_leader_id !== (user as any).id) {
          skipped.push(`${email} (already linked to another TL)`);
          continue;
        }

        if (!invite) {
          const { error: insertInviteError } = await (supabaseAdmin.from("referral_invites") as any).insert({
            team_leader_id: (user as any).id,
            email,
            status: "pending",
            created_at: now,
            updated_at: now,
          });

          if (insertInviteError) {
            skipped.push(`${email} (reserve failed: ${insertInviteError.message})`);
            continue;
          }
        } else {
          await (supabaseAdmin.from("referral_invites") as any)
            .update({ updated_at: now })
            .eq("id", invite.id);
        }

        if (existingProfile && !existingReferral) {
          const { error: insertReferralError } = await (supabaseAdmin.from("referrals") as any).insert({
            team_leader_id: (user as any).id,
            referred_user_id: existingProfile.id,
            referral_code_used: (user as any).referral_code || "EMAIL_INVITE",
            status: "active",
          });

          if (insertReferralError) {
            warnings.push(`${email} (could not auto-link existing account: ${insertReferralError.message})`);
          } else {
            autoLinked += 1;
            await (supabaseAdmin.from("referral_invites") as any)
              .update({
                status: "accepted",
                claimed_by: existingProfile.id,
                claimed_at: now,
                updated_at: now,
              })
              .eq("team_leader_id", (user as any).id)
              .eq("email", email);

            await (supabaseAdmin.from("notifications") as any).insert({
              user_id: (user as any).id,
              type: "referral_signup",
              title: "Email invite matched",
              message: `${existingProfile.full_name || existingProfile.email} was linked to your team from an invited email.`,
              data: { referred_user_id: existingProfile.id, source: "email_invite" },
            });
          }

          continue;
        }

        const sendResult = await sendTemplatedEmail({
          to: email,
          templateId: "referral_invite",
          locale: (user as any).language || null,
          payload: {
            inviterName: (user as any).full_name || "Your Team Leader",
            referralLink,
            welcomeMessage: (user as any).tl_welcome_message,
          },
        });

        if (!sendResult.ok) {
          warnings.push(`${email} (${sendResult.error})`);
          continue;
        }

        sentEmails += 1;
      }

      const message = `Processed ${emails.length} emails: ${sentEmails} sent, ${autoLinked} auto-linked, ${skipped.length} skipped.`;
      const warning = warnings.length > 0 || skipped.length > 0
        ? [
            skipped.length > 0 ? `Skipped: ${skipped.join("; ")}` : null,
            warnings.length > 0 ? `Warnings: ${warnings.join("; ")}` : null,
          ].filter(Boolean).join(" ")
        : undefined;

      return data({ success: true, message, warning });
    }

    default:
      return data({ error: "Unknown action" }, { status: 400 });
  }
}

export default function TLDashboard() {
  const { user, appUrl, referrals, referredUsers, reservedEmails, stats, weeklyData } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [copied, setCopied] = useState(false);
  const [inviteFields, setInviteFields] = useState(1);

  const referralLink = `${appUrl}/join/${(user as any).referral_code}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maxWeeklyNew = Math.max(...weeklyData.map((w: any) => w.newSignups), 1);
  const chartMax = Math.max(4, Math.ceil(maxWeeklyNew / 2) * 2);
  const yTicks = [chartMax, Math.floor(chartMax * 0.66), Math.floor(chartMax * 0.33), 0];
  const maxCumulative = Math.max(...weeklyData.map((w: any) => w.cumulative), 1);
  const cumulativeLinePoints = weeklyData
    .map((week: any, index: number) => {
      const x = weeklyData.length === 1 ? 0 : (index / (weeklyData.length - 1)) * 100;
      const y = 100 - (week.cumulative / maxCumulative) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  const reservedStatusLabel: Record<string, string> = {
    pending: "Reserved",
    accepted: "Linked",
  };

  return (
    <div className="min-h-full bg-gray-50">
      <Header user={user} />
      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="mb-2">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-900">
            Team Leader Dashboard
          </h1>
          <p className="text-gray-500">Grow and manage your runner community</p>
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
      {actionData && "warning" in actionData && (actionData as any).warning && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm">
          {(actionData as any).warning}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-brand-600 to-brand-500 rounded-xl p-5 border border-brand-600 shadow-sm text-white">
          <p className="text-xs uppercase tracking-wide text-brand-100">Total Referred Runners</p>
          <p className="text-4xl font-bold mt-1">{stats.totalReferrals}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">New in last 30 days</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.newInLast30Days}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Currently active referrals</p>
          <p className="text-3xl font-bold text-brand-600 mt-1">{stats.activeReferrals}</p>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-6 -mt-3">
        Runner activity can be seasonal. Use cumulative growth and monthly new signups as your main progress signals.
      </p>

      {/* Growth chart */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-gray-900">Growth Trend</h2>
          <span className="text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 font-medium">
            Last 8 weeks
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Bars = new signups per week. Line = cumulative referred runners.
        </p>

        <div className="relative h-52 border border-gray-100 rounded-xl bg-gradient-to-b from-gray-50 to-white p-3 overflow-hidden">
          <div className="absolute inset-3 flex flex-col justify-between pointer-events-none z-0">
            {yTicks.map((tick, index) => (
              <div key={index} className="border-t border-dashed border-gray-200 relative">
                <span className="absolute -top-2 -left-1 bg-white px-1 text-[10px] text-gray-400">{tick}</span>
              </div>
            ))}
          </div>

          <svg className="absolute inset-3 z-10 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke="#2563eb"
              strokeWidth="1.8"
              points={cumulativeLinePoints}
              vectorEffect="non-scaling-stroke"
            />
            {weeklyData.map((week: any, index: number) => {
              const x = weeklyData.length === 1 ? 0 : (index / (weeklyData.length - 1)) * 100;
              const y = 100 - (week.cumulative / maxCumulative) * 100;
              return <circle key={`pt-${index}`} cx={x} cy={y} r="1.7" fill="#2563eb" />;
            })}
          </svg>

          <div className="relative z-20 h-full flex items-end gap-2.5 pt-4">
            {weeklyData.map((week: any, i: number) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                <span className="text-xs font-semibold text-gray-900">{week.newSignups}</span>
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-brand-500 to-brand-300/90 shadow-sm transition-all duration-500"
                  style={{
                    height: `${Math.max((week.newSignups / chartMax) * 100, 6)}%`,
                    minHeight: "6px",
                  }}
                  title={`${week.label}: ${week.newSignups} new · ${week.cumulative} total`}
                />
                <span className="text-[11px] text-gray-500 mt-1">{week.label}</span>
              </div>
            ))}
          </div>
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
            className="btn-primary rounded-full text-sm px-4 py-2.5 flex-shrink-0"
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
          <button type="submit" className="btn-secondary rounded-full text-sm px-4 py-2">
            Save Code
          </button>
        </Form>
      </div>

      {/* Invite by email */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-6">
        <h2 className="font-display font-semibold text-gray-900 mb-2">Invite by Email</h2>

        <Form method="post" className="space-y-3">
          <input type="hidden" name="_action" value="sendInvites" />
          {Array.from({ length: inviteFields }).map((_, index) => (
            <input
              key={index}
              type="email"
              name={`inviteEmail${index}`}
              placeholder={`lead${index + 1}@example.com`}
              className="input"
              required={index === 0}
            />
          ))}

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary rounded-full text-xs px-3 py-1.5"
              onClick={() => setInviteFields((prev) => Math.min(MAX_BATCH_INVITES, prev + 1))}
              disabled={inviteFields >= MAX_BATCH_INVITES}
            >
              Add email
            </button>
            <button
              type="button"
              className="btn-secondary rounded-full text-xs px-3 py-1.5"
              onClick={() => setInviteFields((prev) => Math.max(1, prev - 1))}
              disabled={inviteFields <= 1}
            >
              Remove
            </button>
            <span className="text-xs text-gray-500">{inviteFields}/{MAX_BATCH_INVITES}</span>
          </div>

          <button type="submit" className="btn-primary rounded-full text-sm px-4 py-2">
            Send Invitations
          </button>
        </Form>
      </div>

      {/* Reserved emails */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-display font-semibold text-gray-900">Reserved Emails</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {reservedEmails.length > 0 ? (
            reservedEmails.map((invite: any) => (
              <div key={invite.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{invite.email}</p>
                  <p className="text-xs text-gray-500">
                    Added {new Date(invite.created_at).toLocaleDateString()}
                    {invite.claimed_at ? ` · Claimed ${new Date(invite.claimed_at).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                    invite.status === "accepted"
                      ? "bg-success-100 text-success-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {reservedStatusLabel[invite.status] || invite.status}
                </span>
              </div>
            ))
          ) : (
            <div className="p-6 text-sm text-gray-500">No reserved emails yet.</div>
          )}
        </div>
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
          <button type="submit" className="btn-secondary rounded-full text-sm">
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
                      {refUser?.email && refUser?.full_name && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {refUser.email}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">
                          Joined {new Date(ref.created_at).toLocaleDateString()}
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
                    {ref.status === "active" ? "Active" : "Registered"}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-sm text-gray-500 mb-1">No referrals yet</p>
              <p className="text-xs text-gray-400">Share your referral link to start growing your community!</p>
            </div>
          )}
        </div>
      </div>
      </main>
    </div>
  );
}
