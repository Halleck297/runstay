// app/routes/join.$code.tsx - Referral landing page with registration
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { useLoaderData, useActionData, Form, Link } from "react-router";
import { supabase, supabaseAdmin } from "~/lib/supabase.server";
import { createUserSession, getUserId } from "~/lib/session.server";
import { useI18n } from "~/hooks/useI18n";

function normalizeEmail(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[“”‘’"'`]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const tlName = (data as any)?.teamLeader?.full_name || "a Team Leader";
  return [{ title: `Join Runoot - Invited by ${tlName}` }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const code = params.code;

  if (!code) {
    throw redirect("/register");
  }

  // Check if user is already logged in
  const userId = await getUserId(request);

  // Find the TL by referral code
  const { data: teamLeader } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, company_name, user_type, avatar_url, is_verified, referral_code, tl_welcome_message")
    .eq("referral_code", code)
    .eq("user_type", "team_leader")
    .single();

  if (!teamLeader) {
    return { status: "invalid" as const, teamLeader: null, alreadyLoggedIn: false, code };
  }

  // If already logged in, do not auto-link.
  // TL invite flow is intended for new runner registrations.
  if (userId) {
    const { data: currentUserProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, user_type")
      .eq("id", userId)
      .maybeSingle();

    const nextPath = (currentUserProfile as any)?.user_type === "tour_operator" ? "/to-panel" : "/listings";

    const { data: existingRef } = await supabaseAdmin
      .from("referrals")
      .select("id")
      .eq("referred_user_id", userId)
      .single();

    if (existingRef) {
      return { status: "already_referred" as const, teamLeader, alreadyLoggedIn: true, code, nextPath };
    }
    return { status: "needs_new_registration" as const, teamLeader, alreadyLoggedIn: true, code, nextPath };
  }

  return { status: "valid" as const, teamLeader, alreadyLoggedIn: false, code, nextPath: "/listings" };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const code = params.code as string;
  if (!code) {
    return data({ errorKey: "invalid_referral_code" as const }, { status: 400 });
  }
  const formData = await request.formData();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;
  const userType = "private";
  const companyName = null;

  if (!email || !password || !fullName) {
    return data({ errorKey: "all_fields_required" as const }, { status: 400 });
  }

  if (password.length < 8) {
    return data({ errorKey: "password_min" as const }, { status: 400 });
  }

  // Find the TL
  const { data: teamLeader } = await supabaseAdmin
    .from("profiles")
    .select("id, referral_code")
    .eq("referral_code", code)
    .eq("user_type", "team_leader")
    .single();

  if (!teamLeader) {
    return data({ errorKey: "invalid_referral_code" as const }, { status: 400 });
  }

  const normalizedEmail = normalizeEmail(email);
  const { data: emailInvite } = await (supabaseAdmin.from("referral_invites") as any)
    .select("id, team_leader_id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  const attributedTeamLeaderId = emailInvite?.team_leader_id || (teamLeader as any).id;

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        user_type: userType,
        company_name: null,
      },
    },
  });

  if (authError) {
    return data({ error: authError.message }, { status: 400 });
  }

  if (!authData.user) {
    return data({ errorKey: "registration_failed" as const }, { status: 400 });
  }

  // Email confirmation required?
  if (!authData.session) {
    return data({
      success: true,
      emailConfirmationRequired: true,
      messageKey: "join_referral.check_email_body" as const,
    });
  }

  // Create profile
  const now = new Date().toISOString();
  const { error: profileError } = await (supabaseAdmin.from("profiles") as any).insert({
    id: authData.user.id,
    email,
    full_name: fullName,
    user_type: userType,
    company_name: null,
    is_verified: false,
    last_login_at: now,
  });

  if (profileError) {
    console.error("Profile creation error:", profileError);
  }

  // Create referral link
  await (supabaseAdmin.from("referrals") as any).insert({
    team_leader_id: attributedTeamLeaderId,
    referred_user_id: authData.user.id,
    referral_code_used: emailInvite ? "EMAIL_INVITE" : code,
    status: "registered",
  });

  if (emailInvite) {
    await (supabaseAdmin.from("referral_invites") as any)
      .update({
        status: "accepted",
        claimed_by: authData.user.id,
        claimed_at: now,
        updated_at: now,
      })
      .eq("id", emailInvite.id);
  }

  // Notify TL
  await (supabaseAdmin.from("notifications") as any).insert({
    user_id: attributedTeamLeaderId,
    type: "referral_signup",
    title: "New referral!",
    message: `${fullName || email} joined via your referral link.`,
    data: { referred_user_id: authData.user.id, referral_code: emailInvite ? "EMAIL_INVITE" : code },
  });

  const postSignupRedirect = "/listings";

  return createUserSession(
    authData.user.id,
    authData.session.access_token,
    authData.session.refresh_token,
    postSignupRedirect
  );
}

export default function JoinReferral() {
  const { t } = useI18n();
  const { status, teamLeader, code, nextPath } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | { error: string; errorKey?: never }
    | { errorKey: "invalid_referral_code" | "all_fields_required" | "password_min" | "registration_failed"; error?: never }
    | { success: boolean; emailConfirmationRequired: boolean; message: string; messageKey?: never }
    | { success: boolean; emailConfirmationRequired: boolean; messageKey: "join_referral.check_email_body"; message?: never }
    | undefined;
  const errorMessage =
    actionData && "errorKey" in actionData
      ? t(`join_referral.error.${actionData.errorKey}` as any)
      : actionData && "error" in actionData
      ? actionData.error
      : null;

  // Invalid code
  if (status === "invalid") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t("join_referral.invalid_title")}</h1>
          <p className="text-gray-500 mb-6">{t("join_referral.invalid_body")}</p>
          <Link to="/register" className="btn-primary inline-block w-full py-3">
            {t("join_referral.signup_normal")}
          </Link>
        </div>
      </div>
    );
  }

  // Already referred
  if (status === "already_referred") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t("join_referral.already_connected_title")}</h1>
          <p className="text-gray-500 mb-6">{t("join_referral.already_connected_body")}</p>
          <Link to={nextPath} className="btn-primary inline-block w-full py-3">
            {nextPath === "/to-panel" ? t("join_referral.go_dashboard") : t("join_referral.browse_listings")}
          </Link>
        </div>
      </div>
    );
  }

  // Logged-in users must create a new runner account for TL invite flow
  if (status === "needs_new_registration") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t("join_referral.new_runner_title")}</h1>
          <p className="text-gray-500 mb-6">
            {t("join_referral.new_runner_body")}
          </p>
          <Form method="post" action="/logout" className="mb-2">
            <button type="submit" className="btn-primary inline-block w-full py-3">
              {t("join_referral.logout_continue")}
            </button>
          </Form>
          <Link to={nextPath} className="btn-secondary inline-block w-full py-3">
            {t("listings.back")}
          </Link>
          <p className="text-xs text-gray-400 mt-4">
            {t("join_referral.runner_only_note")}
          </p>
        </div>
      </div>
    );
  }

  // Valid — show registration form
  const tl = teamLeader as any;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* TL invitation card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6 text-center">
          <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3">
            <span className="text-xl font-bold text-purple-700">
              {tl?.full_name?.charAt(0) || "T"}
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-1">{t("join_referral.invited_by")}</p>
          <h2 className="font-display text-xl font-bold text-gray-900">
            {tl?.full_name || t("team_invite.team_leader")}
          </h2>
          {tl?.company_name && (
            <p className="text-sm text-gray-500">{tl.company_name}</p>
          )}
          {tl?.is_verified && (
            <div className="flex items-center justify-center gap-1 mt-1">
              <svg className="w-4 h-4 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-xs text-brand-600 font-medium">{t("dashboard.verified")}</span>
            </div>
          )}
          {tl?.tl_welcome_message && (
            <p className="mt-3 text-sm text-gray-600 italic border-t border-gray-100 pt-3">
              "{tl.tl_welcome_message}"
            </p>
          )}
        </div>

        {/* Registration form */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-8 px-4 sm:px-10">
          <h2 className="font-display text-2xl font-bold text-gray-900 text-center mb-2">
            {t("join_referral.join_title")}
          </h2>
          <p className="text-center text-sm text-gray-500 mb-6">
            {t("join_referral.join_subtitle")}
          </p>

          {/* Email confirmation message */}
          {actionData && "emailConfirmationRequired" in actionData && (actionData as any).emailConfirmationRequired ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t("auth.check_email")}</h3>
              <p className="text-sm text-gray-600 mb-6">
                {"messageKey" in (actionData as any)
                  ? t((actionData as any).messageKey)
                  : (actionData as any).message}
              </p>
              <Link to="/login" className="btn-primary inline-block">
                {t("auth.go_to_login")}
              </Link>
            </div>
          ) : (
            <Form method="post" className="space-y-5">
              {errorMessage && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <div>
                <label htmlFor="fullName" className="label">{t("profile.form.full_name")}</label>
                <input id="fullName" name="fullName" type="text" autoComplete="name" required className="input w-full" />
              </div>

              <div>
                <label htmlFor="email" className="label">{t("auth.email")}</label>
                <input id="email" name="email" type="email" autoComplete="email" required className="input w-full" />
              </div>

              <div>
                <label htmlFor="password" className="label">{t("auth.password")}</label>
                <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="input w-full" />
                <p className="mt-1 text-xs text-gray-500">{t("auth.password_min")}</p>
              </div>

              <input type="hidden" name="userType" value="private" />
              <div className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-700">
                {t("join_referral.runner_account_note")}
              </div>

              <button type="submit" className="btn-primary w-full py-3">
                {t("join_referral.create_account")}
              </button>

              <p className="text-xs text-gray-500 text-center">
                {t("auth.have_account")}{" "}
                <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500">
                  {t("auth.sign_in")}
                </Link>
              </p>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
