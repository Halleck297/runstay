// app/routes/become-tl.$token.tsx - Accept TL invite token
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { useLoaderData, useActionData, Form, Link } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { useI18n } from "~/hooks/useI18n";

export const meta: MetaFunction = () => {
  return [{ title: "Become a Team Leader - Runoot" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const token = params.token;

  if (!token) {
    throw redirect("/");
  }

  // Already a TL?
  if ((user as any).is_team_leader) {
    return { status: "already_tl" as const, user, token: null };
  }

  // Find the token
  const { data: tokenData } = await supabaseAdmin
    .from("tl_invite_tokens")
    .select("*")
    .eq("token", token)
    .single();

  if (!tokenData) {
    return { status: "invalid" as const, user, token: null };
  }

  // Check if already used
  if ((tokenData as any).used_by) {
    return { status: "used" as const, user, token: null };
  }

  // Check if expired
  if ((tokenData as any).expires_at && new Date((tokenData as any).expires_at) < new Date()) {
    return { status: "expired" as const, user, token: null };
  }

  return { status: "valid" as const, user, token: tokenData };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const tokenValue = params.token;

  if (!tokenValue) {
    return data({ errorKey: "no_token" as const }, { status: 400 });
  }

  if ((user as any).is_team_leader) {
    return data({ errorKey: "already_tl" as const }, { status: 400 });
  }

  // Verify token again
  const { data: tokenData } = await supabaseAdmin
    .from("tl_invite_tokens")
    .select("*")
    .eq("token", tokenValue)
    .single();

  if (!tokenData) {
    return data({ errorKey: "invalid_token" as const }, { status: 400 });
  }

  if ((tokenData as any).used_by) {
    return data({ errorKey: "token_used" as const }, { status: 400 });
  }

  if ((tokenData as any).expires_at && new Date((tokenData as any).expires_at) < new Date()) {
    return data({ errorKey: "token_expired" as const }, { status: 400 });
  }

  // Generate referral code
  const baseName = (user as any).full_name || (user as any).email.split("@")[0] || "TL";
  let code = baseName.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 8) + new Date().getFullYear();

  // Check uniqueness
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("referral_code", code)
    .single();

  if (existing) {
    code = code + Math.floor(Math.random() * 100);
  }

  // Promote to TL
  await (supabaseAdmin.from("profiles") as any)
    .update({
      is_team_leader: true,
      referral_code: code,
    })
    .eq("id", (user as any).id);

  // Mark token as used
  await (supabaseAdmin.from("tl_invite_tokens") as any)
    .update({
      used_by: (user as any).id,
      used_at: new Date().toISOString(),
    })
    .eq("token", tokenValue);

  // Send notification
  await (supabaseAdmin.from("notifications") as any).insert({
    user_id: (user as any).id,
    type: "tl_promoted",
    title: "Welcome, Team Leader!",
    message: `You've accepted the invite and are now a Team Leader! Your referral code is ${code}. Visit your TL Dashboard to customize it.`,
    data: { referral_code: code },
  });

  return redirect("/tl-dashboard");
}

export default function BecomeTL() {
  const { t } = useI18n();
  const { status, user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as { errorKey?: string } | undefined;
  const actionError =
    actionData?.errorKey ? t(`tl_invite.error.${actionData.errorKey}` as any) : null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          {status === "valid" && (
            <>
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">
                {t("tl_invite.title")}
              </h1>
              <p className="text-gray-500 mb-6">
                {t("tl_invite.subtitle")}
              </p>

              {actionError && (
                <div className="mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm">
                  {actionError}
                </div>
              )}

              <Form method="post">
                <button type="submit" className="btn-primary w-full text-base py-3">
                  {t("tl_invite.accept")}
                </button>
              </Form>
              <p className="text-xs text-gray-400 mt-4">
                {t("tl_invite.logged_as")} {(user as any).full_name || (user as any).email}
              </p>
            </>
          )}

          {status === "already_tl" && (
            <>
              <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-brand-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">
                {t("tl_invite.already_title")}
              </h1>
              <p className="text-gray-500 mb-6">
                {t("tl_invite.already_body")}
              </p>
              <Link to="/tl-dashboard" className="btn-primary inline-block w-full py-3">
                {t("tl_invite.go_dashboard")}
              </Link>
            </>
          )}

          {status === "invalid" && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">
                {t("tl_invite.invalid_title")}
              </h1>
              <p className="text-gray-500 mb-6">
                {t("tl_invite.invalid_body")}
              </p>
              <Link to="/" className="btn-secondary inline-block w-full py-3">
                {t("not_found.go_home")}
              </Link>
            </>
          )}

          {status === "used" && (
            <>
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">
                {t("tl_invite.used_title")}
              </h1>
              <p className="text-gray-500 mb-6">
                {t("tl_invite.used_body")}
              </p>
              <Link to="/" className="btn-secondary inline-block w-full py-3">
                {t("not_found.go_home")}
              </Link>
            </>
          )}

          {status === "expired" && (
            <>
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">
                {t("tl_invite.expired_title")}
              </h1>
              <p className="text-gray-500 mb-6">
                {t("tl_invite.expired_body")}
              </p>
              <Link to="/" className="btn-secondary inline-block w-full py-3">
                {t("not_found.go_home")}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
