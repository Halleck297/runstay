import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { NotFoundPage } from "~/components/NotFoundPage";
import { useI18n } from "~/hooks/useI18n";
import { supabaseAdmin } from "~/lib/supabase.server";
import { getUserId } from "~/lib/session.server";
import { resolveLocaleForRequest } from "~/lib/locale";
import { sendTemplatedEmail } from "~/lib/email/service.server";

function normalizeEmail(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[""''\"'`]/g, "")
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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
    .select("id, full_name, company_name, user_type, avatar_url, is_verified, referral_code, tl_welcome_message, email")
    .or(`referral_slug.ilike.${code},referral_code.ilike.${code}`)
    .eq("platform_role", "team_leader")
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

    const nextPath = (currentUserProfile as any)?.user_type === "agency" ? "/to-panel" : "/listings";
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
  const _action = String(formData.get("_action") || "submit_join_request");

  if (_action !== "submit_join_request") {
    return data({ errorKey: "invalid_referral_code" as const }, { status: 400 });
  }

  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  // Validation
  if (!firstName || !lastName) {
    return data({ errorKey: "join_request.error_required" as const }, { status: 400 });
  }
  if (!email || !isValidEmail(email)) {
    return data({ errorKey: "join_request.error_email" as const }, { status: 400 });
  }

  const normalizedEmail = normalizeEmail(email);

  // Resolve TL
  const { data: teamLeader } = await supabaseAdmin
    .from("profiles")
    .select("id, referral_code, email, full_name")
    .or(`referral_slug.ilike.${code},referral_code.ilike.${code}`)
    .eq("platform_role", "team_leader")
    .maybeSingle();

  if (!teamLeader) {
    return data({ errorKey: "invalid_referral_code" as const }, { status: 400 });
  }

  const tlId = (teamLeader as any).id;
  const tlEmail = (teamLeader as any).email;

  // Check for duplicate pending request
  const { data: existingRequest } = await (supabaseAdmin.from("team_join_requests" as any) as any)
    .select("id")
    .eq("tl_id", tlId)
    .eq("email", normalizedEmail)
    .eq("status", "pending")
    .maybeSingle();

  if (existingRequest) {
    return data({ errorKey: "join_request.duplicate" as const }, { status: 400 });
  }

  // Insert join request
  const { error: insertError } = await (supabaseAdmin.from("team_join_requests" as any) as any).insert({
    tl_id: tlId,
    first_name: firstName,
    last_name: lastName,
    email: normalizedEmail,
    notes: notes || null,
    status: "pending",
  });

  if (insertError) {
    console.error("Join request insert error:", insertError);
    return data({ errorKey: "join_request.error_required" as const }, { status: 500 });
  }

  // Send notification email to TL
  const locale = resolveLocaleForRequest(request, null);
  try {
    await sendTemplatedEmail({
      templateId: "join_request_notification",
      to: tlEmail,
      locale: locale,
      payload: {
        requesterFirstName: firstName,
        requesterLastName: lastName,
        requesterEmail: normalizedEmail,
        dashboardLink: `${process.env.APP_URL}/tl-dashboard/requests`,
      },
    });
  } catch (emailError) {
    console.error("Failed to send join request notification email:", emailError);
    // Don't fail the request if email fails
  }

  return data({ success: true });
}

export default function CatchAllRoute() {
  const { t } = useI18n();
  const loaderData = useLoaderData<typeof loader>() as any;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  if (loaderData.mode !== "referral") {
    return <NotFoundPage />;
  }

  const { status, teamLeader, nextPath } = loaderData;
  const actionData = useActionData<typeof action>() as
    | { errorKey: string }
    | { success: boolean }
    | undefined;

  const errorMessage =
    actionData && "errorKey" in actionData
      ? t(actionData.errorKey as any)
      : null;

  const isSuccess = actionData && "success" in actionData && actionData.success;

  if (status === "already_referred") {
    return (
      <div className="flex items-start justify-center px-4 pt-8 pb-24 sm:min-h-screen sm:items-center sm:pt-0 sm:pb-0">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-8 text-center">
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
      <div className="flex items-start justify-center px-4 pt-8 pb-24 sm:min-h-screen sm:items-center sm:pt-0 sm:pb-0">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-8 text-center">
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
      <div className="flex items-start justify-center px-4 pt-8 pb-24 sm:min-h-screen sm:items-center sm:pt-0 sm:pb-0">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t("join_referral.new_runner_title")}</h1>
          <p className="text-gray-500 mb-6">{t("join_referral.new_runner_body")}</p>
          <Form method="post" action="/logout" className="mb-2">
            <button type="submit" disabled={isSubmitting} className="btn-primary inline-block w-full py-3 disabled:opacity-60">{isSubmitting ? "…" : t("join_referral.logout_continue")}</button>
          </Form>
          <Link to={nextPath} className="btn-secondary inline-block w-full py-3">{t("listings.back")}</Link>
          <p className="text-xs text-gray-400 mt-4">{t("join_referral.runner_only_note")}</p>
        </div>
      </div>
    );
  }

  const tl = teamLeader as any;

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
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-xl font-bold text-purple-700">{tl?.full_name?.charAt(0) || "T"}</span>
              </div>
            )}
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

        {/* Join request form */}
        <div className="py-8 px-0 sm:bg-white sm:rounded-3xl sm:border sm:border-brand-500 sm:shadow-sm sm:px-10">
          {isSuccess ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">{t("join_request.success_title")}</h2>
              <p className="text-gray-500">{t("join_request.success_body")}</p>
            </div>
          ) : (
            <>
              <div className="mb-8 text-center">
                <h2 className="mb-1 font-display text-[1.7rem] font-bold text-gray-900 underline decoration-accent-500 underline-offset-4">
                  {t("join_common.create_account_title")}
                </h2>
                <p className="text-sm text-gray-500">{t("join_request.subtitle")}</p>
              </div>

              <Form method="post" className="flex flex-col gap-5 [&_.input]:border [&_.input]:border-solid [&_.input]:border-accent-500 [&_.input]:shadow-none [&_.input:focus]:border-brand-500 [&_.input:focus]:ring-brand-500/20">
                <input type="hidden" name="_action" value="submit_join_request" />

                {errorMessage && <div className="rounded-3xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>}

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

                <div>
                  <label htmlFor="email" className="label">{t("join_request.email")}</label>
                  <input id="email" name="email" type="email" autoComplete="email" required className="input w-full rounded-full !pl-4" />
                </div>

                <div>
                  <label htmlFor="notes" className="label">{t("join_request.notes")}</label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    placeholder={t("join_request.notes_placeholder")}
                    className="input w-full rounded-2xl !pl-4 !pt-3 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary mx-auto mt-4 flex rounded-full px-8 py-3 font-bold"
                >
                  {t("join_request.submit")}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  {t("auth.have_account")}{" "}
                  <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500">{t("auth.sign_in")}</Link>
                </p>
              </Form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
