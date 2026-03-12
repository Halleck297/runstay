import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import { NotFoundPage } from "~/components/NotFoundPage";
import { useI18n } from "~/hooks/useI18n";
import { supabase, supabaseAdmin } from "~/lib/supabase.server";
import { createUserSession, getUserId } from "~/lib/session.server";
import { buildLocaleCookie, isSupportedLocale, LOCALE_LABELS, resolveLocaleForRequest } from "~/lib/locale";
import { getSupportedCountries, resolveSupportedCountry } from "~/lib/supportedCountries";

function normalizeEmail(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[“”‘’\"'`]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function getSinglePathSegment(pathname: string): string | null {
  const cleaned = pathname.replace(/^\/+|\/+$/g, "");
  if (!cleaned) return null;
  if (cleaned.includes("/")) return null;
  return decodeURIComponent(cleaned);
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if ((data as any)?.mode === "referral" && (data as any)?.teamLeader) {
    const tlName = (data as any).teamLeader?.full_name || "a Team Leader";
    return [{ title: `Join Runoot - Invited by ${tlName}` }];
  }
  return [{ title: "Page Not Found - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = getSinglePathSegment(url.pathname);
  if (!code) {
    return data({ mode: "not_found", pathname: url.pathname }, { status: 404 });
  }

  const detectedLocale = resolveLocaleForRequest(request, null);
  const userId = await getUserId(request);

  const { data: teamLeader } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, company_name, user_type, avatar_url, is_verified, referral_code, tl_welcome_message")
    .ilike("referral_code", code)
    .eq("user_type", "team_leader")
    .maybeSingle();

  if (!teamLeader) {
    return data({ mode: "not_found", pathname: url.pathname }, { status: 404 });
  }

  if (userId) {
    const { data: currentUserProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, user_type")
      .eq("id", userId)
      .maybeSingle();

    const nextPath = (currentUserProfile as any)?.user_type === "tour_operator" ? "/to-panel" : "/listings";
    const showRegistrationSuccess = url.searchParams.get("registered") === "1";

    if (showRegistrationSuccess) {
      return {
        mode: "referral" as const,
        status: "registration_success" as const,
        teamLeader,
        alreadyLoggedIn: true,
        code: (teamLeader as any).referral_code,
        nextPath,
        detectedLocale,
      };
    }

    const { data: existingRef } = await supabaseAdmin
      .from("referrals")
      .select("id")
      .eq("referred_user_id", userId)
      .single();

    if (existingRef) {
      return {
        mode: "referral" as const,
        status: "already_referred" as const,
        teamLeader,
        alreadyLoggedIn: true,
        code: (teamLeader as any).referral_code,
        nextPath,
        detectedLocale,
      };
    }

    return {
      mode: "referral" as const,
      status: "needs_new_registration" as const,
      teamLeader,
      alreadyLoggedIn: true,
      code: (teamLeader as any).referral_code,
      nextPath,
      detectedLocale,
    };
  }

  return {
    mode: "referral" as const,
    status: "valid" as const,
    teamLeader,
    alreadyLoggedIn: false,
    code: (teamLeader as any).referral_code,
    nextPath: "/listings",
    detectedLocale,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const code = getSinglePathSegment(url.pathname);

  if (!code) {
    return data({ errorKey: "invalid_referral_code" as const }, { status: 400 });
  }

  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;
  const country = formData.get("country") as string;
  const city = formData.get("city") as string;
  const phone = formData.get("phone") as string;
  const preferredLanguageRaw = String(formData.get("preferredLanguage") || "").trim().toLowerCase();
  const preferredLanguage = isSupportedLocale(preferredLanguageRaw)
    ? preferredLanguageRaw
    : resolveLocaleForRequest(request, null);
  const resolvedCountry = resolveSupportedCountry(country, preferredLanguage);
  const dateOfBirthRaw = String(formData.get("dateOfBirth") || "").trim();

  if (!email || !password || !fullName || !country || !city || !dateOfBirthRaw) {
    return data({ errorKey: "all_fields_required" as const }, { status: 400 });
  }
  if (!resolvedCountry) {
    return data({ error: "Country not supported yet, contact support" }, { status: 400 });
  }
  if (password.length < 8) {
    return data({ errorKey: "password_min" as const }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirthRaw)) {
    return data({ error: "Date of birth must be in YYYY-MM-DD format" }, { status: 400 });
  }

  const { data: teamLeader } = await supabaseAdmin
    .from("profiles")
    .select("id, referral_code")
    .ilike("referral_code", code)
    .eq("user_type", "team_leader")
    .maybeSingle();

  if (!teamLeader) {
    return data({ errorKey: "invalid_referral_code" as const }, { status: 400 });
  }

  const normalizedEmail = normalizeEmail(email);
  const { data: emailInvite } = await (supabaseAdmin.from("referral_invites") as any)
    .select("id, team_leader_id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  const attributedTeamLeaderId = emailInvite?.team_leader_id || (teamLeader as any).id;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        user_type: "private",
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

  if (!authData.session) {
    return data({
      success: true,
      emailConfirmationRequired: true,
      messageKey: "join_referral.check_email_body" as const,
    });
  }

  const now = new Date().toISOString();
  const { error: profileError } = await (supabaseAdmin.from("profiles") as any).insert({
    id: authData.user.id,
    email,
    full_name: fullName,
    user_type: "private",
    company_name: null,
    country: resolvedCountry.nameEn,
    city: city.trim(),
    phone: phone?.trim() || null,
    preferred_language: preferredLanguage,
    date_of_birth: dateOfBirthRaw,
    is_verified: false,
    last_login_at: now,
  });

  if (profileError) {
    console.error("Profile creation error:", profileError);
  }

  await (supabaseAdmin.from("referrals") as any).insert({
    team_leader_id: attributedTeamLeaderId,
    referred_user_id: authData.user.id,
    referral_code_used: emailInvite ? "EMAIL_INVITE" : String((teamLeader as any).referral_code || code),
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

  await (supabaseAdmin.from("notifications") as any).insert({
    user_id: attributedTeamLeaderId,
    type: "referral_signup",
    title: "New referral!",
    message: `${fullName || email} joined via your referral link.`,
    data: {
      referred_user_id: authData.user.id,
      referral_code: emailInvite ? "EMAIL_INVITE" : String((teamLeader as any).referral_code || code),
    },
  });

  const canonicalCode = String((teamLeader as any).referral_code || code).toLowerCase();
  const postSignupRedirect = `/${encodeURIComponent(canonicalCode)}?registered=1`;

  return createUserSession(
    authData.user.id,
    authData.session.access_token,
    authData.session.refresh_token,
    postSignupRedirect,
    {
      additionalSetCookies: [buildLocaleCookie(preferredLanguage as any)],
    }
  );
}

export default function CatchAllRoute() {
  const { t } = useI18n();
  const loaderData = useLoaderData<typeof loader>() as any;

  if (loaderData.mode !== "referral") {
    return <NotFoundPage />;
  }

  const { status, teamLeader, nextPath, detectedLocale } = loaderData;
  const countries = getSupportedCountries(detectedLocale);
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

  if (status === "already_referred") {
    return (
      <div className="min-h-screen bg-[#ECF4FE] flex items-center justify-center px-4">
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

  if (status === "registration_success") {
    return (
      <div className="min-h-screen bg-[#ECF4FE] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t("join_referral.registration_success_title")}</h1>
          <p className="text-gray-500 mb-6">{t("join_referral.registration_success_body")}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link to="/listings" className="btn-primary inline-block w-full py-3">
              {t("join_referral.browse_listings")}
            </Link>
            <Link to="/profile" className="btn-secondary inline-block w-full py-3">
              {t("nav.profile")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === "needs_new_registration") {
    return (
      <div className="min-h-screen bg-[#ECF4FE] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t("join_referral.new_runner_title")}</h1>
          <p className="text-gray-500 mb-6">{t("join_referral.new_runner_body")}</p>
          <Form method="post" action="/logout" className="mb-2">
            <button type="submit" className="btn-primary inline-block w-full py-3">{t("join_referral.logout_continue")}</button>
          </Form>
          <Link to={nextPath} className="btn-secondary inline-block w-full py-3">{t("listings.back")}</Link>
          <p className="text-xs text-gray-400 mt-4">{t("join_referral.runner_only_note")}</p>
        </div>
      </div>
    );
  }

  const tl = teamLeader as any;

  return (
    <div className="min-h-screen bg-[#ECF4FE] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6 text-center">
          <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3">
            <span className="text-xl font-bold text-purple-700">{tl?.full_name?.charAt(0) || "T"}</span>
          </div>
          <p className="text-sm text-gray-500 mb-1">{t("join_referral.invited_by")}</p>
          <h2 className="font-display text-xl font-bold text-gray-900">{tl?.full_name || t("team_invite.team_leader")}</h2>
          {tl?.company_name && <p className="text-sm text-gray-500">{tl.company_name}</p>}
          {tl?.is_verified && (
            <div className="flex items-center justify-center gap-1 mt-1">
              <svg className="w-4 h-4 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-xs text-brand-600 font-medium">{t("dashboard.verified")}</span>
            </div>
          )}
          {tl?.tl_welcome_message && <p className="mt-3 text-sm text-gray-600 italic border-t border-gray-100 pt-3">"{tl.tl_welcome_message}"</p>}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-8 px-4 sm:px-10">
          <h2 className="font-display text-2xl font-bold text-gray-900 text-center mb-2">{t("join_referral.join_title")}</h2>
          <p className="text-center text-sm text-gray-500 mb-6">{t("join_referral.join_subtitle")}</p>

          {actionData && "emailConfirmationRequired" in actionData && (actionData as any).emailConfirmationRequired ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t("auth.check_email")}</h3>
              <p className="text-sm text-gray-600 mb-6">
                {"messageKey" in (actionData as any) ? t((actionData as any).messageKey) : (actionData as any).message}
              </p>
              <Link to="/login" className="btn-primary inline-block">{t("auth.go_to_login")}</Link>
            </div>
          ) : (
            <Form method="post" className="space-y-5">
              {errorMessage && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>}

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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="dateOfBirth" className="label">Date of birth</label>
                  <input id="dateOfBirth" name="dateOfBirth" type="date" required className="input w-full" />
                </div>
                <div>
                  <label htmlFor="phone" className="label">{t("profile.form.phone_number")}</label>
                  <input id="phone" name="phone" type="tel" autoComplete="tel" className="input w-full" required />
                </div>
                <div>
                  <label htmlFor="country" className="label">{t("profile.form.country")}</label>
                  <input id="country" name="country" type="text" list="join-country-list" className="input w-full" required autoComplete="off" />
                  <datalist id="join-country-list">
                    {countries.map((countryOption) => (
                      <option key={countryOption.code} value={countryOption.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label htmlFor="city" className="label">{t("profile.form.city")}</label>
                  <input id="city" name="city" type="text" className="input w-full" required />
                </div>
              </div>

              <div>
                <label htmlFor="preferredLanguage" className="label">Language</label>
                <select id="preferredLanguage" name="preferredLanguage" className="input w-full" required defaultValue={detectedLocale}>
                  {Object.entries(LOCALE_LABELS).map(([langCode, label]) => (
                    <option key={langCode} value={langCode}>{label}</option>
                  ))}
                </select>
              </div>

              <input type="hidden" name="userType" value="private" />
              <div className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("join_referral.runner_account_note")}</div>

              <button type="submit" className="btn-primary w-full py-3">{t("join_referral.create_account")}</button>

              <p className="text-xs text-gray-500 text-center">
                {t("auth.have_account")}{" "}
                <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500">{t("auth.sign_in")}</Link>
              </p>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
