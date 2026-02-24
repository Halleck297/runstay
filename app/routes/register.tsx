import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData } from "react-router";
import { useI18n } from "~/hooks/useI18n";
import { supabase, supabaseAdmin } from "~/lib/supabase.server";
import { createUserSession, getUserId } from "~/lib/session.server";
import { buildLocaleCookie, LOCALE_LABELS, isSupportedLocale } from "~/lib/locale";
import type { SupportedLocale } from "~/lib/locale";

export const meta: MetaFunction = () => {
  return [{ title: "Sign Up - Runoot" }];
};

function normalizeEmail(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[“”‘’"'`]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await getUserId(request);
  if (userId) return redirect("/to-panel");
  return {};
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const fullName = formData.get("fullName");
  const country = formData.get("country");
  const language = formData.get("language");
  const userType = "private";

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof fullName !== "string" ||
    typeof country !== "string" ||
    typeof language !== "string"
  ) {
    return data({ error: "Invalid form submission" }, { status: 400 });
  }

  if (!email || !password || !fullName || !language) {
    return data({ error: "All fields are required" }, { status: 400 });
  }

  if (!isSupportedLocale(language.toLowerCase())) {
    return data({ error: "Invalid language selected" }, { status: 400 });
  }

  const normalizedLanguage = language.toLowerCase() as SupportedLocale;

  if (password.length < 8) {
    return data(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  // Create auth user with metadata
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
    return data(
      { error: "Registration failed. Please try again." },
      { status: 400 }
    );
  }

  // Check if email confirmation is required
  if (!authData.session) {
    // Email confirmation is required
    return data({
      success: true,
      emailConfirmationRequired: true,
      message: "Please check your email to confirm your account before logging in.",
    });
  }

  // Create profile (only if session exists, meaning email is confirmed or confirmation disabled)
  const now = new Date().toISOString();
  const { error: profileError } = await supabase.from("profiles").insert({
    id: authData.user.id,
    email: email,
    full_name: fullName,
    user_type: userType,
    country: country.trim() || null,
    preferred_language: normalizedLanguage,
    company_name: null,
    is_verified: Boolean(authData.user.email_confirmed_at),
    last_login_at: now,
  } as any);

  if (profileError) {
    console.error("Profile creation error:", profileError);
    // Auth user created but profile failed - still log them in
  } else {
    const normalizedEmail = normalizeEmail(email);
    const { data: emailInvite } = await (supabaseAdmin.from("referral_invites") as any)
      .select("id, team_leader_id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (emailInvite && userType === "private") {
      const { data: existingReferral } = await supabaseAdmin
        .from("referrals")
        .select("id, team_leader_id")
        .eq("referred_user_id", authData.user.id)
        .maybeSingle();

      if (!existingReferral) {
        const { error: referralError } = await (supabaseAdmin.from("referrals") as any).insert({
          team_leader_id: emailInvite.team_leader_id,
          referred_user_id: authData.user.id,
          referral_code_used: "EMAIL_INVITE",
          status: "registered",
        });

        if (!referralError) {
          await (supabaseAdmin.from("referral_invites") as any)
            .update({
              status: "accepted",
              claimed_by: authData.user.id,
              claimed_at: now,
              updated_at: now,
            })
            .eq("id", emailInvite.id);

          await (supabaseAdmin.from("notifications") as any).insert({
            user_id: emailInvite.team_leader_id,
            type: "referral_signup",
            title: "New referral!",
            message: `${fullName || email} joined with one of your reserved emails.`,
            data: { referred_user_id: authData.user.id, source: "email_invite" },
          });
        } else {
          console.error("Auto referral from email invite failed:", referralError);
        }
      }
    }
  }

  return createUserSession(
    authData.user.id,
    authData.session.access_token,
    authData.session.refresh_token,
    "/to-panel",
    {
      additionalSetCookies: [buildLocaleCookie(normalizedLanguage)],
    }
  );
}

export default function Register() {
  const { t } = useI18n();
  const actionData = useActionData<typeof action>() as 
    | { error: string }
    | { success: boolean; emailConfirmationRequired: boolean; message: string }
    | undefined;

  return (
    <div className="min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
            <svg
              className="h-7 w-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
        </Link>
        <h2 className="mt-6 text-center font-display text-3xl font-bold tracking-tight text-gray-900">
          {t("auth.create_account")}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {t("auth.have_account")}{" "}
          <Link
            to="/login"
            className="font-medium text-brand-600 hover:text-brand-500"
          >
            {t("auth.sign_in")}
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm rounded-xl sm:px-10 border border-gray-200">
          {actionData && "emailConfirmationRequired" in actionData && actionData.emailConfirmationRequired ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t("auth.check_email")}
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                {"message" in actionData ? actionData.message : "Please check your email to confirm your account."}
              </p>
              <Link
                to="/login"
                className="btn-primary inline-block"
              >
                {t("auth.go_to_login")}
              </Link>
            </div>
          ) : (
            <Form method="post" className="space-y-6">
              {actionData && "error" in actionData && actionData.error && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                  {"error" in actionData ? actionData.error : ""}
                </div>
              )}

            <div>
              <label htmlFor="fullName" className="label">
                Full name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                className="input"
              />
            </div>

            <div>
              <label htmlFor="email" className="label">
                {t("auth.email")}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input"
              />
            </div>

            <div>
              <label htmlFor="country" className="label">
                Country
              </label>
              <input
                id="country"
                name="country"
                type="text"
                autoComplete="country-name"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="language" className="label">
                Preferred language
              </label>
              <select
                id="language"
                name="language"
                defaultValue="en"
                required
                className="input"
              >
                {Object.entries(LOCALE_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="password" className="label">
                {t("auth.password")}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="input"
              />
              <p className="mt-1 text-xs text-gray-500">
                {t("auth.password_min")}
              </p>
            </div>

            <input type="hidden" name="userType" value="private" />
            <div className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-700">
              Standard signup creates a <strong>Runner</strong> account.
            </div>

            <div>
              <button type="submit" className="btn-primary w-full">
                Create account
              </button>
            </div>

            <p className="text-sm text-center text-gray-700">
              Are you a tour operator, agency, organizer, or authorized reseller?{" "}
              <Link to="/contact?subject=partnership" className="font-semibold text-brand-600 hover:text-brand-500">
                Click here
              </Link>
            </p>

            <p className="text-xs text-gray-500 text-center">
              By signing up, you agree to our Terms of Service and Privacy
              Policy.
            </p>
          </Form>
          )}
        </div>
      </div>
    </div>
  );
}
