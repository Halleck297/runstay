import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useLoaderData, useActionData } from "react-router";
import { getUserId, requireUserId } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { useI18n } from "~/hooks/useI18n";

function normalizeEmail(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[“”‘’\"'`]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

type InviteLoaderStatus =
  | "invalid"
  | "accepted"
  | "login_required"
  | "wrong_account"
  | "already_linked"
  | "linked_other"
  | "not_runner"
  | "ready";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const tlName = (data as any)?.teamLeader?.full_name || "Team Leader";
  return [{ title: `Join ${tlName}'s Team - Runoot` }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const inviteId = params.inviteId;
  if (!inviteId) {
    return data({ status: "invalid" as InviteLoaderStatus }, { status: 404 });
  }

  const { data: invite } = await (supabaseAdmin.from("referral_invites") as any)
    .select("id, email, status, team_leader_id, invite_type")
    .eq("id", inviteId)
    .maybeSingle();

  if (!invite || invite.invite_type !== "existing_runner") {
    return data({ status: "invalid" as InviteLoaderStatus }, { status: 404 });
  }

  const { data: teamLeader } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .eq("id", invite.team_leader_id)
    .maybeSingle();

  if (invite.status === "accepted") {
    return {
      status: "accepted" as InviteLoaderStatus,
      teamLeader,
      inviteEmail: invite.email,
    };
  }

  const userId = await getUserId(request);
  const currentPath = new URL(request.url).pathname;
  if (!userId) {
    return {
      status: "login_required" as InviteLoaderStatus,
      teamLeader,
      inviteEmail: invite.email,
      loginPath: `/login?redirectTo=${encodeURIComponent(currentPath)}`,
    };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, email, user_type")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return {
      status: "login_required" as InviteLoaderStatus,
      teamLeader,
      inviteEmail: invite.email,
      loginPath: `/login?redirectTo=${encodeURIComponent(currentPath)}`,
    };
  }

  if (normalizeEmail(profile.email) !== normalizeEmail(invite.email)) {
    return {
      status: "wrong_account" as InviteLoaderStatus,
      teamLeader,
      inviteEmail: invite.email,
    };
  }

  if (profile.user_type !== "private") {
    return {
      status: "not_runner" as InviteLoaderStatus,
      teamLeader,
      inviteEmail: invite.email,
    };
  }

  const { data: existingReferral } = await supabaseAdmin
    .from("referrals")
    .select("id, team_leader_id")
    .eq("referred_user_id", profile.id)
    .maybeSingle();

  if (existingReferral?.team_leader_id === invite.team_leader_id) {
    return {
      status: "already_linked" as InviteLoaderStatus,
      teamLeader,
      inviteEmail: invite.email,
    };
  }

  if (existingReferral?.team_leader_id) {
    return {
      status: "linked_other" as InviteLoaderStatus,
      teamLeader,
      inviteEmail: invite.email,
    };
  }

  return {
    status: "ready" as InviteLoaderStatus,
    teamLeader,
    inviteEmail: invite.email,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const inviteId = params.inviteId;
  if (!inviteId) {
    return data({ errorKey: "invalid_invite" as const }, { status: 400 });
  }

  const userId = await requireUserId(request, new URL(request.url).pathname);

  const { data: invite } = await (supabaseAdmin.from("referral_invites") as any)
    .select("id, email, status, team_leader_id, invite_type")
    .eq("id", inviteId)
    .maybeSingle();

  if (!invite || invite.invite_type !== "existing_runner") {
    return data({ errorKey: "invite_not_found" as const }, { status: 404 });
  }

  if (invite.status === "accepted") {
    return redirect("/listings");
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, user_type")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return data({ errorKey: "profile_not_found" as const }, { status: 400 });
  }

  if (normalizeEmail(profile.email) !== normalizeEmail(invite.email)) {
    return data({ errorKey: "wrong_email" as const }, { status: 403 });
  }

  if (profile.user_type !== "private") {
    return data({ errorKey: "only_runner" as const }, { status: 400 });
  }

  const { data: existingReferral } = await supabaseAdmin
    .from("referrals")
    .select("id, team_leader_id")
    .eq("referred_user_id", profile.id)
    .maybeSingle();

  if (existingReferral?.team_leader_id && existingReferral.team_leader_id !== invite.team_leader_id) {
    return data({ errorKey: "linked_other" as const }, { status: 400 });
  }

  if (!existingReferral) {
    const { error: insertReferralError } = await (supabaseAdmin.from("referrals") as any).insert({
      team_leader_id: invite.team_leader_id,
      referred_user_id: profile.id,
      referral_code_used: "EXISTING_RUNNER_INVITE",
      status: "registered",
    });

    if (insertReferralError) {
      return data({ error: insertReferralError.message }, { status: 500 });
    }
  }

  const now = new Date().toISOString();
  await (supabaseAdmin.from("referral_invites") as any)
    .update({
      status: "accepted",
      claimed_by: profile.id,
      claimed_at: now,
      updated_at: now,
    })
    .eq("id", invite.id);

  await (supabaseAdmin.from("notifications") as any).insert({
    user_id: invite.team_leader_id,
    type: "referral_signup",
    title: "Team invite accepted",
    message: `${profile.full_name || profile.email} accepted your team invitation.`,
    data: { referred_user_id: profile.id, source: "existing_runner_invite" },
  });

  return data({ success: true });
}

export default function JoinTeamInvite() {
  const { t } = useI18n();
  const loaderData = useLoaderData<typeof loader>() as any;
  const actionData = useActionData<typeof action>() as
    | { error?: string; success?: boolean; errorKey?: never }
    | { errorKey?: string; success?: boolean; error?: never }
    | undefined;
  const status = loaderData?.status as InviteLoaderStatus;
  const teamLeaderName = loaderData?.teamLeader?.full_name || t("team_invite.team_leader");
  const inviteEmail = loaderData?.inviteEmail as string | undefined;
  const actionError =
    actionData?.errorKey ? t(`team_invite.error.${actionData.errorKey}` as any) : actionData?.error;

  if (actionData?.success) {
    return (
      <div className="min-h-screen bg-[#ECF4FE] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t("team_invite.joined_title")}</h1>
          <p className="text-gray-600 mb-6">{t("team_invite.joined_body")} {teamLeaderName}.</p>
          <Link to="/listings" className="btn-primary inline-block w-full py-3">
            {t("team_invite.go_listings")}
          </Link>
        </div>
      </div>
    );
  }

  const messageByStatus: Record<Exclude<InviteLoaderStatus, "ready">, string> = {
    invalid: t("team_invite.status.invalid"),
    accepted: t("team_invite.status.accepted"),
    login_required: `${t("team_invite.status.login_required_prefix")} ${inviteEmail || t("team_invite.invited_email")} ${t("team_invite.status.login_required_suffix")}`,
    wrong_account: `${t("team_invite.status.wrong_account_prefix")} ${inviteEmail}. ${t("team_invite.status.wrong_account_suffix")}`,
    already_linked: t("team_invite.status.already_linked"),
    linked_other: t("team_invite.status.linked_other"),
    not_runner: t("team_invite.status.not_runner"),
  };

  if (status !== "ready") {
    return (
      <div className="min-h-screen bg-[#ECF4FE] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t("team_invite.title")}</h1>
          <p className="text-gray-600 mb-6">{messageByStatus[status]}</p>
          {status === "login_required" ? (
            <Link to={loaderData.loginPath} className="btn-primary inline-block w-full py-3">
              {t("team_invite.signin_continue")}
            </Link>
          ) : (
            <Link to="/listings" className="btn-primary inline-block w-full py-3">
              {t("team_invite.go_listings")}
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#ECF4FE] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t("team_invite.join_prefix")} {teamLeaderName}</h1>
        <p className="text-gray-600 mb-6">
          {t("team_invite.ready_body")}
        </p>
        {actionError && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</div>
        )}
        <Form method="post">
          <button type="submit" className="btn-primary inline-block w-full py-3">
            {t("team_invite.accept")}
          </button>
        </Form>
      </div>
    </div>
  );
}
