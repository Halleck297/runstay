import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { useState } from "react";
import { useI18n } from "~/hooks/useI18n";
import { supabaseAdmin, supabase } from "~/lib/supabase.server";
import { createUserSession, getUser } from "~/lib/session.server";
import { resolveLocaleForRequest, type SupportedLocale } from "~/lib/locale";
import { translate } from "~/lib/i18n";

const LEGAL_TERMS_VERSION = "2026-03-15";
const LEGAL_PRIVACY_VERSION = "2026-03-15";

async function logLegalConsent(args: {
  userId: string;
  email: string;
  locale: SupportedLocale;
}) {
  const now = new Date().toISOString();
  await (supabaseAdmin.from("legal_consents" as any) as any).insert({
    user_id: args.userId,
    email: args.email,
    source: "join_token",
    locale: args.locale,
    terms_accepted_at: now,
    privacy_accepted_at: now,
    terms_version: LEGAL_TERMS_VERSION,
    privacy_version: LEGAL_PRIVACY_VERSION,
    created_at: now,
  });
}

export const meta: MetaFunction<typeof loader> = ({ data: loaderData }) => {
  const d = loaderData as any;
  if (d?.teamLeader?.full_name) {
    return [{ title: `Join ${d.teamLeader.full_name}'s team - Runoot` }];
  }
  return [{ title: "Join Team - Runoot" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const token = params.token;
  if (!token) {
    return data({ status: "invalid" as const });
  }

  const locale = resolveLocaleForRequest(request, null);

  // Find invite by token
  const { data: invite } = await (supabaseAdmin.from("referral_invites" as any) as any)
    .select("id, team_leader_id, email, status, token")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return data({ status: "invalid" as const, locale });
  }

  if (invite.status === "accepted" || invite.status === "claimed") {
    return data({ status: "already_used" as const, locale });
  }

  // Fetch TL profile
  const { data: teamLeader } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, company_name, avatar_url, is_verified, tl_welcome_message")
    .eq("id", invite.team_leader_id)
    .single();

  if (!teamLeader) {
    return data({ status: "invalid" as const, locale });
  }

  // Check if user is already logged in
  const currentUser = await getUser(request);

  return data({
    status: "ready" as const,
    teamLeader,
    invitedEmail: invite.email,
    isLoggedIn: !!currentUser,
    currentUserEmail: currentUser?.email || null,
    locale,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const token = params.token;
  if (!token) {
    return data({ errorKey: "join_token.invalid" }, { status: 400 });
  }

  const locale = resolveLocaleForRequest(request, null);
  const formData = await request.formData();

  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const acceptTerms = formData.get("acceptTerms") === "on";

  // Validation
  if (!firstName || !lastName) {
    return data({ errorKey: "join_request.error_required" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return data({ errorKey: "register.error.password_too_short" }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return data({ errorKey: "register.error.passwords_no_match" }, { status: 400 });
  }
  if (!acceptTerms) {
    return data({ errorKey: "register.error.terms_required" }, { status: 400 });
  }

  // Fetch invite — email comes from DB, not user input
  const { data: invite } = await (supabaseAdmin.from("referral_invites" as any) as any)
    .select("id, team_leader_id, email, status")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return data({ errorKey: "join_token.invalid" }, { status: 400 });
  }
  if (invite.status === "accepted" || invite.status === "claimed") {
    return data({ errorKey: "join_token.already_used" }, { status: 400 });
  }

  const email = invite.email;
  const fullName = `${firstName} ${lastName}`;

  // Create Supabase auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      user_type: "private",
    },
  });

  if (authError || !authData?.user?.id) {
    console.error("Join token: auth user creation failed:", authError);
    // If user already exists, show a helpful message
    if (authError?.message?.includes("already been registered")) {
      return data({ errorKey: "register.error.email_taken" }, { status: 400 });
    }
    return data({ errorKey: "register.error.submit_failed" }, { status: 500 });
  }

  const userId = authData.user.id;
  const now = new Date().toISOString();

  // Create profile
  await (supabaseAdmin.from("profiles") as any).upsert({
    id: userId,
    full_name: fullName,
    email,
    user_type: "private",
    preferred_language: locale,
    created_at: now,
    updated_at: now,
  });

  // Create referral link
  const { data: tl } = await supabaseAdmin
    .from("profiles")
    .select("referral_code")
    .eq("id", invite.team_leader_id)
    .single();

  await (supabaseAdmin.from("referrals" as any) as any).insert({
    referred_user_id: userId,
    team_leader_id: invite.team_leader_id,
    referral_code_used: (tl as any)?.referral_code || "TOKEN_INVITE",
    status: "registered",
    created_at: now,
  });

  // Update invite status
  await (supabaseAdmin.from("referral_invites" as any) as any)
    .update({
      status: "accepted",
      claimed_by: userId,
      claimed_at: now,
      updated_at: now,
    })
    .eq("id", invite.id);

  // Log legal consent
  try {
    await logLegalConsent({ userId, email, locale });
  } catch (e) {
    console.error("Failed to log legal consent:", e);
  }

  // Sign in the new user and redirect
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInData?.session) {
    // Account created but couldn't sign in — redirect to login
    return redirect("/login");
  }

  return createUserSession(
    signInData.user.id,
    signInData.session.access_token,
    signInData.session.refresh_token,
    "/listings"
  );
}

export default function JoinByToken() {
  const { t } = useI18n();
  const loaderData = useLoaderData<typeof loader>() as any;
  const actionData = useActionData<typeof action>() as any;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showPassword, setShowPassword] = useState(false);

  const { status } = loaderData;

  const errorMessage = actionData?.errorKey
    ? t(actionData.errorKey as any)
    : null;

  // Invalid token
  if (status === "invalid") {
    return (
      <div className="flex items-start justify-center px-4 pt-8 pb-24 sm:min-h-screen sm:items-center sm:pt-0 sm:pb-0">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t("join_token.invalid")}</h1>
          <Link to="/" className="btn-primary mt-6 inline-block w-full py-3">Runoot Home</Link>
        </div>
      </div>
    );
  }

  // Already used
  if (status === "already_used") {
    return (
      <div className="flex items-start justify-center px-4 pt-8 pb-24 sm:min-h-screen sm:items-center sm:pt-0 sm:pb-0">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t("join_token.already_used")}</h1>
          <Link to="/login" className="btn-primary mt-6 inline-block w-full py-3">{t("auth.sign_in")}</Link>
        </div>
      </div>
    );
  }

  // Ready — registration form
  const tl = loaderData.teamLeader;
  const invitedEmail = loaderData.invitedEmail;

  return (
    <div className="flex flex-col justify-start pt-8 pb-24 px-4 sm:min-h-screen sm:justify-center sm:py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        {/* TL info card */}
        <div className="bg-white rounded-3xl border border-brand-500 shadow-sm p-6 mb-6 text-center">
          <div className="mx-auto mb-3 h-14 w-14 overflow-hidden rounded-full bg-purple-100">
            {tl?.avatar_url ? (
              <img
                src={tl.avatar_url}
                alt={tl?.full_name ? `${tl.full_name} avatar` : "Team Leader avatar"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-bold text-purple-600">
                {tl?.full_name?.charAt(0)?.toUpperCase() || "T"}
              </div>
            )}
          </div>
          <h1 className="font-display text-lg font-bold text-gray-900">
            {tl?.full_name}
          </h1>
          {tl?.company_name && (
            <p className="text-sm text-gray-500">{tl.company_name}</p>
          )}
          {tl?.is_verified && (
            <div className="mt-1 flex items-center justify-center gap-1">
              <svg className="h-4 w-4 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-xs text-brand-600 font-medium">{t("dashboard.verified")}</span>
            </div>
          )}
          {tl?.tl_welcome_message && (
            <p className="mt-3 text-sm text-gray-600 italic border-t border-gray-100 pt-3">"{tl.tl_welcome_message}"</p>
          )}
        </div>

        {/* Registration form */}
        <div className="py-8 px-0 sm:bg-white sm:rounded-3xl sm:border sm:border-brand-500 sm:shadow-sm sm:px-10">
          <div className="mb-6 text-center">
            <h2 className="mb-1 font-display text-[1.7rem] font-bold text-gray-900 underline decoration-accent-500 underline-offset-4">
              {t("join_token.title").replace("{name}", tl?.full_name || "")}
            </h2>
            <p className="text-sm text-gray-500">{t("join_token.subtitle")}</p>
          </div>

          <Form method="post" className="flex flex-col gap-5 [&_.input]:border [&_.input]:border-solid [&_.input]:border-accent-500 [&_.input]:shadow-none [&_.input:focus]:border-brand-500 [&_.input:focus]:ring-brand-500/20">
            {errorMessage && (
              <div className="rounded-3xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>
            )}

            {/* Email — locked */}
            <div>
              <label htmlFor="email" className="label">{t("join_request.email")}</label>
              <input
                id="email"
                type="email"
                value={invitedEmail || ""}
                disabled
                className="input w-full rounded-full !pl-4 bg-gray-100 text-gray-500 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-400">{t("join_token.email_locked")}</p>
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="label">{t("join_request.first_name")}</label>
                <input id="firstName" name="firstName" type="text" autoComplete="given-name" required className="input w-full rounded-full !pl-4" />
              </div>
              <div>
                <label htmlFor="lastName" className="label">{t("join_request.last_name")}</label>
                <input id="lastName" name="lastName" type="text" autoComplete="family-name" required className="input w-full rounded-full !pl-4" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="input w-full rounded-full !pl-4 !pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878l4.242 4.242M21 21l-3.122-3.122" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">{t("auth.password_min")}</p>
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirmPassword" className="label">{t("auth.confirm_password")}</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                className="input w-full rounded-full !pl-4"
              />
            </div>

            {/* Terms */}
            <label className="flex items-start gap-2 text-sm text-gray-600">
              <input type="checkbox" name="acceptTerms" required className="mt-1 rounded border-gray-300" />
              <span>
                {t("register.legal_accept_terms_prefix")}{" "}
                <Link to="/terms" target="_blank" className="text-brand-600 hover:underline">{t("footer.terms")}</Link>
                {" & "}
                <Link to="/privacy-policy" target="_blank" className="text-brand-600 hover:underline">{t("footer.privacy")}</Link>
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary mx-auto mt-4 flex rounded-full px-8 py-3 font-bold disabled:opacity-50"
            >
              {isSubmitting ? "..." : t("join_token.register")}
            </button>

            <p className="text-xs text-gray-500 text-center">
              {t("auth.have_account")}{" "}
              <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500">{t("auth.sign_in")}</Link>
            </p>
          </Form>
        </div>
      </div>
    </div>
  );
}
