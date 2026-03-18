import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, Link, data, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { createCookie } from "react-router";
import { useMemo, useState } from "react";
import { useI18n } from "~/hooks/useI18n";
import { resolveLocaleForRequest } from "~/lib/locale";
import { requireUser, destroyUserSessionCookie } from "~/lib/session.server";
import { getDialingPrefix, getSupportedCountries, resolveSupportedCountry } from "~/lib/supportedCountries";
import { supabaseAdmin } from "~/lib/supabase.server";
import { checkPhoneVerificationCode, startPhoneVerification } from "~/lib/twilio-verify.server";
import { getDefaultAppPath, needsAdminPhoneVerification } from "~/lib/user-access";

export const meta: MetaFunction = () => [{ title: "Verify Phone - Runoot" }];

type PhoneVerificationCookieState = {
  userId: string;
  pendingPhoneE164?: string;
};

const phoneVerificationCookie = createCookie("runoot_admin_phone_verification", {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60,
  secrets: [process.env.SESSION_SECRET || "runoot-dev-secret"],
});

function normalizeToE164(dialingPrefix: string, rawPhone: string): string | null {
  let nationalDigits = String(rawPhone || "").replace(/[^\d]/g, "");
  const dialingDigits = dialingPrefix.replace("+", "");
  if (nationalDigits.startsWith(dialingDigits)) {
    nationalDigits = nationalDigits.slice(dialingDigits.length);
  }
  if (!nationalDigits) return null;
  return `${dialingPrefix}${nationalDigits}`;
}

function normalizeDisplayPhone(dialingPrefix: string, rawPhone: string): string | null {
  let nationalDigits = String(rawPhone || "").replace(/[^\d]/g, "");
  const dialingDigits = dialingPrefix.replace("+", "");
  if (nationalDigits.startsWith(dialingDigits)) {
    nationalDigits = nationalDigits.slice(dialingDigits.length);
  }
  if (!nationalDigits) return null;
  return `${dialingPrefix} ${nationalDigits}`;
}

async function readPhoneVerificationState(request: Request): Promise<PhoneVerificationCookieState | undefined> {
  try {
    const parsed = (await phoneVerificationCookie.parse(request.headers.get("Cookie"))) as unknown;
    if (!parsed || typeof parsed !== "object") return undefined;
    const maybe = parsed as Record<string, unknown>;
    if (typeof maybe.userId !== "string") return undefined;
    return {
      userId: maybe.userId,
      pendingPhoneE164: typeof maybe.pendingPhoneE164 === "string" ? maybe.pendingPhoneE164 : undefined,
    };
  } catch {
    return undefined;
  }
}

type ActionData =
  | {
      errorKey:
        | "country_unsupported"
        | "phone_required"
        | "phone_otp_required"
        | "phone_otp_send_failed"
        | "phone_otp_invalid";
      formValues?: { country?: string; phone?: string; phoneOtpCode?: string };
      infoKey?: never;
      success?: never;
    }
  | {
      infoKey: "phone_otp_sent";
      formValues?: { country?: string; phone?: string; phoneOtpCode?: string };
      errorKey?: never;
      success?: never;
    };

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  if (url.searchParams.get("done") === "1") {
    return { completed: true as const };
  }

  const user = await requireUser(request);
  if (!needsAdminPhoneVerification(user)) {
    return redirect(getDefaultAppPath(user));
  }
  return { completed: false as const, user };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  if (!needsAdminPhoneVerification(user)) {
    return redirect(getDefaultAppPath(user));
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "").trim();
  const country = String(formData.get("country") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const phoneOtpCode = String(formData.get("phoneOtpCode") || "").trim();
  const locale = resolveLocaleForRequest(request, (user as any)?.preferred_language);
  const resolvedCountry = resolveSupportedCountry(country, locale);
  const formValues = { country, phone, phoneOtpCode };
  const currentPhoneVerification = await readPhoneVerificationState(request);

  if (!resolvedCountry) {
    return data<ActionData>({ errorKey: "country_unsupported", formValues }, { status: 400 });
  }

  const dialingPrefix = getDialingPrefix(resolvedCountry.code);
  const phoneE164 = normalizeToE164(dialingPrefix, phone);
  const normalizedPhone = normalizeDisplayPhone(dialingPrefix, phone);

  if (intent === "send_phone_otp") {
    if (!phoneE164) {
      return data<ActionData>({ errorKey: "phone_required", formValues }, { status: 400 });
    }

    try {
      await startPhoneVerification(phoneE164);
    } catch (error) {
      console.error("verify-phone send otp failed", error);
      return data<ActionData>({ errorKey: "phone_otp_send_failed", formValues }, { status: 400 });
    }

    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      await phoneVerificationCookie.serialize({
        userId: user.id,
        pendingPhoneE164: phoneE164,
      })
    );
    return data<ActionData>({ infoKey: "phone_otp_sent", formValues }, { headers });
  }

  if (intent === "verify_phone_otp") {
    if (!phoneE164 || !normalizedPhone) {
      return data<ActionData>({ errorKey: "phone_required", formValues }, { status: 400 });
    }
    if (!phoneOtpCode) {
      return data<ActionData>({ errorKey: "phone_otp_required", formValues }, { status: 400 });
    }

    const pendingPhoneE164 =
      currentPhoneVerification?.userId === user.id ? currentPhoneVerification.pendingPhoneE164 : undefined;
    if (!pendingPhoneE164 || pendingPhoneE164 !== phoneE164) {
      return data<ActionData>({ errorKey: "phone_otp_send_failed", formValues }, { status: 400 });
    }

    let approved = false;
    try {
      approved = await checkPhoneVerificationCode(phoneE164, phoneOtpCode);
    } catch (error) {
      console.error("verify-phone check otp failed", error);
      return data<ActionData>({ errorKey: "phone_otp_invalid", formValues }, { status: 400 });
    }
    if (!approved) {
      return data<ActionData>({ errorKey: "phone_otp_invalid", formValues }, { status: 400 });
    }

    await (supabaseAdmin.from("profiles") as any)
      .update({
        phone: normalizedPhone,
        phone_verified_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    const headers = new Headers();
    headers.append("Set-Cookie", await phoneVerificationCookie.serialize(""));
    headers.append("Set-Cookie", await destroyUserSessionCookie(request));
    return redirect("/verify-phone?done=1", { headers });
  }

  return data<ActionData>({ errorKey: "phone_otp_send_failed", formValues }, { status: 400 });
}

export default function VerifyPhone() {
  const loaderData = useLoaderData<typeof loader>() as { completed: boolean };
  const { t, locale } = useI18n();
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const countries = getSupportedCountries(locale);

  const [countryValue, setCountryValue] = useState(actionData?.formValues?.country || "");
  const [phoneValue, setPhoneValue] = useState(actionData?.formValues?.phone || "");
  const [phoneOtpCodeValue, setPhoneOtpCodeValue] = useState(actionData?.formValues?.phoneOtpCode || "");

  const selectedCountry = useMemo(() => resolveSupportedCountry(countryValue, locale), [countryValue, locale]);
  const phonePrefix = selectedCountry ? getDialingPrefix(selectedCountry.code) : "+--";
  const isSuccess = Boolean(loaderData.completed);

  return (
    <div className="flex min-h-full flex-col justify-center bg-[#ECF4FE] py-12 sm:px-6 lg:px-8">
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-brand-500 bg-white px-4 py-8 shadow-sm sm:px-10">
          <Link to="/" className="mb-5 flex justify-center" aria-label={t("register.go_home_aria")}>
            <img src="/logo225px.png" alt="Runoot" className="h-[4.5rem] w-auto sm:h-[5.5rem]" />
          </Link>
          <h1 className="mb-8 text-center font-display text-2xl font-bold text-gray-900 underline decoration-accent-500 underline-offset-4">
            {t("join_referral.phone_verification_title")}
          </h1>

          {actionData && "errorKey" in actionData && actionData.errorKey && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {t(`join_referral.error.${actionData.errorKey}` as any)}
            </div>
          )}

          {actionData && "infoKey" in actionData && actionData.infoKey === "phone_otp_sent" && (
            <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-700">
              {t("join_referral.phone_otp_sent")}
            </div>
          )}

          {!isSuccess && (
            <div className="space-y-6">
              <Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value="send_phone_otp" />
                <div>
                  <label htmlFor="country" className="label">{t("profile.form.country")}</label>
                  <select
                    id="country"
                    name="country"
                    className="input h-11 w-full rounded-full bg-white !pl-10"
                    style={{ textIndent: "0.45rem" }}
                    required
                    value={countryValue}
                    onChange={(event) => setCountryValue(event.target.value)}
                  >
                    <option value="" disabled>
                      {" "}
                    </option>
                    {countries.map((countryOption) => (
                      <option key={countryOption.code} value={countryOption.code}>
                        {countryOption.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="phone" className="label">{t("profile.form.phone_number")}</label>
                  <div className="flex items-stretch">
                    <span className="shrink-0 rounded-r-none rounded-l-full bg-gray-100 px-3 py-2.5 text-sm text-gray-700 flex items-center justify-center border border-accent-500 border-r-0 shadow-none md:px-4 min-w-[72px]">
                      {phonePrefix}
                    </span>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel-national"
                      className="input w-full rounded-l-none rounded-r-full bg-white"
                      value={phoneValue}
                      onChange={(event) => setPhoneValue(event.target.value)}
                    />
                  </div>
                </div>

                <button type="submit" className="btn-primary w-full rounded-full" disabled={isSubmitting}>
                  {t("join_referral.phone_send_code")}
                </button>
              </Form>

              <Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value="verify_phone_otp" />
                <input type="hidden" name="country" value={countryValue} />
                <input type="hidden" name="phone" value={phoneValue} />
                <div>
                  <label htmlFor="phoneOtpCode" className="label">{t("join_referral.phone_code_label")}</label>
                  <input
                    id="phoneOtpCode"
                    name="phoneOtpCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="input w-full rounded-full !pl-4"
                    value={phoneOtpCodeValue}
                    onChange={(event) => setPhoneOtpCodeValue(event.target.value)}
                  />
                </div>
                <button type="submit" className="btn-primary w-full rounded-full" disabled={isSubmitting}>
                  {t("join_referral.phone_verify_code")}
                </button>
              </Form>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              {t("auth.back_to_login")}
            </Link>
          </div>
        </div>
      </div>

      {isSuccess && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-brand-500 bg-white p-6 text-center">
            <p className="text-base text-green-700">{t("join_referral.phone_otp_verified")}</p>
            <div className="mt-6">
              <Link to="/login" className="btn-primary inline-flex items-center justify-center rounded-full px-6">
                {t("auth.back_to_login")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
