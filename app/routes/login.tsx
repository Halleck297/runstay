import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData, useSearchParams } from "react-router";
import { useI18n } from "~/hooks/useI18n";
import { supabase, supabaseAdmin, isMissingColumnError } from "~/lib/supabase.server";
import { createUserSession, getUser } from "~/lib/session.server";
import { getDefaultAppPath, needsAdminPhoneVerification } from "~/lib/user-access";

export const meta: MetaFunction = () => {
  return [{ title: "Login - Runoot" }];
};


export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (user) {
    if (needsAdminPhoneVerification(user)) {
      return redirect("/verify-phone");
    }
    return redirect(getDefaultAppPath(user));
  }
  return {};
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectToParam = formData.get("redirectTo") as string | null;

  if (typeof email !== "string" || typeof password !== "string") {
    return data({ error: "Invalid form submission" }, { status: 400 });
  }

  if (!email || !password) {
    return data({ error: "Email and password are required" }, { status: 400 });
  }

  let authData: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"] | null = null;
  let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["error"] | null = null;
  try {
    const result = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    authData = result.data;
    error = result.error;
  } catch (err) {
    const cause = (err as any)?.cause as { code?: string } | undefined;
    console.error("login.signInWithPassword failed", {
      message: (err as any)?.message || null,
      causeCode: cause?.code || null,
    });
    return data(
      { error: "Unable to reach authentication service. Please try again in a moment." },
      { status: 503 }
    );
  }

  if (error) {
    return data({ error: error.message }, { status: 400 });
  }

  if (!authData?.session) {
    return data({ error: "Login failed" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await (supabaseAdmin.from("profiles") as any)
    .update({
      last_login_at: now,
      is_verified: Boolean(authData.user.email_confirmed_at),
    })
    .eq("id", authData.user.id);

  await (supabaseAdmin.from("referrals") as any)
    .update({ status: "active" })
    .eq("referred_user_id", authData.user.id)
    .in("status", ["registered", "inactive"]);

  // Get user profile to determine redirect
  let { data: profile, error: profileError } = await (supabaseAdmin.from("profiles") as any)
    .select("user_type, created_by_admin, phone_verified_at")
    .eq("id", authData.user.id)
    .single();
  if (profileError && isMissingColumnError(profileError, "phone_verified_at")) {
    ({ data: profile, error: profileError } = await (supabaseAdmin.from("profiles") as any)
      .select("user_type, created_by_admin")
      .eq("id", authData.user.id)
      .single());
  }

  const requiresPhoneVerification = needsAdminPhoneVerification(profile);
  const defaultPath = requiresPhoneVerification ? "/verify-phone" : getDefaultAppPath(profile);
  let redirectTo = defaultPath;
  if (!requiresPhoneVerification && redirectToParam && redirectToParam !== defaultPath) {
    redirectTo = redirectToParam;
  }

  return createUserSession(
    authData.user.id,
    authData.session.access_token,
    authData.session.refresh_token,
    redirectTo
  );
}

export default function Login() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const actionData = useActionData<typeof action>();
  const redirectTo = searchParams.get("redirectTo") || "";

  return (
    <div className="min-h-full flex flex-col justify-start pt-1 pb-12 sm:pt-2 sm:px-6 lg:px-8 bg-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-3xl">
        <Link to="/" className="flex justify-center" aria-label="Go to home">
          <img src="/logo225px.png" alt="Runoot" className="h-[4.5rem] w-auto sm:h-[5.5rem]" />
        </Link>
      </div>

      <div className="mt-4 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="px-4 py-6 sm:px-2">
          <h2 className="text-center font-display text-3xl font-bold tracking-tight text-gray-900 lowercase">
            {t("auth.welcome_back")}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t("auth.no_account")}{" "}
            <Link
              to="/register"
              className="font-medium text-brand-600 hover:text-brand-500"
            >
              {t("nav.signup")}
            </Link>
          </p>

          <div className="h-8" />

          <Form method="post" className="space-y-6 [&_.input]:border [&_.input]:border-solid [&_.input]:border-accent-500 [&_.input]:shadow-none">
            <input type="hidden" name="redirectTo" defaultValue={redirectTo} />

            {actionData?.error && (
              <div className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {actionData.error}
              </div>
            )}

            <div className="mx-auto w-full max-w-md">
              <label htmlFor="email" className="label">
                {t("auth.email")}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input w-full rounded-full bg-white"
              />
            </div>

            <div className="mx-auto w-full max-w-md">
              <label htmlFor="password" className="label">
                {t("auth.password")}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input w-full rounded-full bg-white"
              />
              <div className="mt-2 ml-4 text-left">
                <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                  {t("auth.forgot_password")}?
                </Link>
              </div>
            </div>

            <div className="pt-4 flex justify-center">
              <button type="submit" className="btn-primary flex w-1/3 justify-center rounded-full">
                {t("auth.sign_in")}
              </button>
            </div>
          </Form>

        </div>
      </div>
    </div>
  );
}
