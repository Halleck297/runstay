import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData, useSearchParams } from "react-router";
import { useI18n } from "~/hooks/useI18n";
import { supabase, supabaseAdmin } from "~/lib/supabase.server";
import { createUserSession, getUserId, getUser } from "~/lib/session.server";
import { getDefaultAppPath } from "~/lib/user-access";

export const meta: MetaFunction = () => {
  return [{ title: "Login - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (user) {
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

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return data({ error: error.message }, { status: 400 });
  }

  if (!authData.session) {
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
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("user_type")
    .eq("id", authData.user.id)
    .single();

  const defaultPath = getDefaultAppPath(profile);
  let redirectTo = defaultPath;
  if (redirectToParam && redirectToParam !== defaultPath) {
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
    <div className="min-h-full flex flex-col justify-start pt-1 pb-12 sm:pt-2 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex justify-center" aria-label="Go to home">
          <img src="/logo.svg" alt="Runoot" className="h-32 w-auto sm:h-40" />
        </Link>
        <h2 className="mt-6 text-center font-display text-3xl font-bold tracking-tight text-gray-900">
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
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm rounded-xl sm:px-10 border border-gray-200">
          <Form method="post" className="space-y-6">
            <input type="hidden" name="redirectTo" value={redirectTo} />

            {actionData?.error && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {actionData.error}
              </div>
            )}

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
              <label htmlFor="password" className="label">
                {t("auth.password")}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input"
              />
              <div className="mt-2 text-right">
                <Link to="/forgot-password" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                  {t("auth.forgot_password")} 
                </Link>
              </div>
            </div>

            <div>
              <button type="submit" className="btn-primary w-full">
                {t("auth.sign_in")}
              </button>
            </div>
          </Form>

        </div>
      </div>
    </div>
  );
}
