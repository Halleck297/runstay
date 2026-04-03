import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "~/hooks/useI18n";
import { getLocaleLabelsForUi, isSupportedLocale, resolveLocaleForRequest, type SupportedLocale } from "~/lib/locale";
import { getDialingPrefix, getSuggestedLocaleForCountry, getSupportedCountries, resolveSupportedCountry } from "~/lib/supportedCountries";
import { getUser } from "~/lib/session.server";
import { supabaseAdmin, isMissingColumnError } from "~/lib/supabase.server";
import { getDefaultAppPath } from "~/lib/user-access";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit.server";
import { translate } from "~/lib/i18n";
import { toTitleCase } from "~/lib/user-display";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const locale = ((data as any)?.detectedLocale as SupportedLocale | undefined) || "en";
  return [{ title: translate(locale, "register.meta_title") }];
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toIsoDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getDobBounds() {
  const now = new Date();
  const max = new Date(now);
  max.setFullYear(max.getFullYear() - 18);
  const min = new Date(now);
  min.setFullYear(min.getFullYear() - 75);
  return {
    minDob: toIsoDateOnly(min),
    maxDob: toIsoDateOnly(max),
  };
}

function normalizeEmail(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[“”‘’"'`]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

const LEGAL_TERMS_VERSION = "2026-03-15";
const LEGAL_PRIVACY_VERSION = "2026-03-15";


async function logLegalConsent(args: {
  accessRequestId?: string | null;
  email: string;
  locale: SupportedLocale;
  source: "register_request";
}) {
  const now = new Date().toISOString();
  await (supabaseAdmin.from("legal_consents" as any) as any).insert({
    access_request_id: args.accessRequestId ?? null,
    email: args.email,
    source: args.source,
    locale: args.locale,
    terms_accepted_at: now,
    privacy_accepted_at: now,
    terms_version: LEGAL_TERMS_VERSION,
    privacy_version: LEGAL_PRIVACY_VERSION,
    created_at: now,
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (user) {
    return redirect(getDefaultAppPath(user));
  }
  return { detectedLocale: resolveLocaleForRequest(request, null) };
}

type ActionData =
  | { errorKey: "register.error.invite_code_required" | "register.error.first_name_required" | "register.error.last_name_required" | "register.error.valid_email_required" | "register.error.country_required" | "register.error.country_unsupported" | "register.error.city_required" | "register.error.date_of_birth_required" | "register.error.date_of_birth_invalid" | "register.error.date_of_birth_too_young" | "register.error.date_of_birth_too_old" | "register.error.note_required" | "register.error.note_too_long" | "register.error.terms_required" | "register.error.privacy_required" | "register.error.submit_failed" | "register.error.too_many_attempts" | "register.error.invalid_action"; field?: string }
  | { success: true; type: "invite_redirect" }
  | { success: true; type: "lead_created"; alreadyPending?: boolean };

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const requestLocale = resolveLocaleForRequest(request, null);

  if (intent === "use_invite") {
    const inviteCode = String(formData.get("inviteCode") || "").trim();
    if (!inviteCode) {
      return data<ActionData>({ errorKey: "register.error.invite_code_required", field: "inviteCode" }, { status: 400 });
    }
    return redirect(`/${encodeURIComponent(inviteCode)}`);
  }

  if (intent === "request_access") {
    // Rate limit: 3 registrations per hour per IP
    const ip = getClientIp(request);
    const rl = checkRateLimit(`register:${ip}`, 3, 60 * 60 * 1000);
    if (!rl.allowed) {
      return data<ActionData>(
        { errorKey: "register.error.too_many_attempts" },
        { status: 429 }
      );
    }

    // Honeypot check — if filled, it's a bot. Return fake success silently.
    const honeypot = formData.get("website");
    if (honeypot) {
      return data<ActionData>({ success: true, type: "lead_created" });
    }

    const firstName = String(formData.get("firstName") || "").trim();
    const lastName = String(formData.get("lastName") || "").trim();
    const fullName = toTitleCase(`${firstName} ${lastName}`.trim());
    const emailRaw = String(formData.get("email") || "").trim();
    const country = String(formData.get("country") || "").trim();
    const city = String(formData.get("city") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const dateOfBirth = String(formData.get("dateOfBirth") || "").trim();
    const note = String(formData.get("note") || "").trim();
    const termsAccepted = String(formData.get("termsAccepted") || "") === "on";
    const privacyAccepted = String(formData.get("privacyAccepted") || "") === "on";
    const preferredLanguageRaw = String(formData.get("language") || "").trim().toLowerCase();
    const preferredLanguage = isSupportedLocale(preferredLanguageRaw)
      ? preferredLanguageRaw
      : requestLocale;
    const resolvedCountry = resolveSupportedCountry(country, preferredLanguage);

    if (!firstName) {
      return data<ActionData>({ errorKey: "register.error.first_name_required", field: "firstName" }, { status: 400 });
    }

    if (!lastName) {
      return data<ActionData>({ errorKey: "register.error.last_name_required", field: "lastName" }, { status: 400 });
    }

    if (!emailRaw || !emailRegex.test(emailRaw)) {
      return data<ActionData>({ errorKey: "register.error.valid_email_required", field: "email" }, { status: 400 });
    }

    if (!country) {
      return data<ActionData>({ errorKey: "register.error.country_required", field: "country" }, { status: 400 });
    }
    if (!resolvedCountry) {
      return data<ActionData>({ errorKey: "register.error.country_unsupported", field: "country" }, { status: 400 });
    }

    if (!city) {
      return data<ActionData>({ errorKey: "register.error.city_required", field: "city" }, { status: 400 });
    }

    if (!dateOfBirth) {
      return data<ActionData>({ errorKey: "register.error.date_of_birth_required", field: "dateOfBirth" }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      return data<ActionData>({ errorKey: "register.error.date_of_birth_invalid", field: "dateOfBirth" }, { status: 400 });
    }
    const { minDob, maxDob } = getDobBounds();
    if (dateOfBirth > maxDob) {
      return data<ActionData>({ errorKey: "register.error.date_of_birth_too_young", field: "dateOfBirth" }, { status: 400 });
    }
    if (dateOfBirth < minDob) {
      return data<ActionData>({ errorKey: "register.error.date_of_birth_too_old", field: "dateOfBirth" }, { status: 400 });
    }

    const dialingPrefix = getDialingPrefix(resolvedCountry.code);
    let normalizedNationalPhone = phone.replace(/[^\d]/g, "");
    const dialingDigits = dialingPrefix.replace("+", "");
    if (normalizedNationalPhone.startsWith(dialingDigits)) {
      normalizedNationalPhone = normalizedNationalPhone.slice(dialingDigits.length);
    }
    const normalizedPhone = normalizedNationalPhone ? `${dialingPrefix} ${normalizedNationalPhone}` : null;

    if (!note || note.length < 10) {
      return data<ActionData>({ errorKey: "register.error.note_required", field: "note" }, { status: 400 });
    }

    if (note.length > 1000) {
      return data<ActionData>({ errorKey: "register.error.note_too_long", field: "note" }, { status: 400 });
    }
    if (!termsAccepted) {
      return data<ActionData>({ errorKey: "register.error.terms_required", field: "termsAccepted" }, { status: 400 });
    }
    if (!privacyAccepted) {
      return data<ActionData>({ errorKey: "register.error.privacy_required", field: "privacyAccepted" }, { status: 400 });
    }

    const email = normalizeEmail(emailRaw);

    const requestPayload = {
      full_name: fullName,
      email,
      country: resolvedCountry.nameEn,
      city: city || null,
      phone: normalizedPhone,
      date_of_birth: dateOfBirth,
      preferred_language: preferredLanguage,
      note: note || null,
      source: "public_signup",
      status: "pending",
    };

    let { data: insertedRequest, error } = await (supabaseAdmin.from("access_requests" as any) as any)
      .insert(requestPayload)
      .select("id")
      .maybeSingle();

    // Compatibility fallback for environments where date_of_birth migration is not yet applied.
    if (error && isMissingColumnError(error, "date_of_birth")) {
      const { date_of_birth: _omitDateOfBirth, ...legacyPayload } = requestPayload;
      ({ data: insertedRequest, error } = await (supabaseAdmin.from("access_requests" as any) as any)
        .insert(legacyPayload)
        .select("id")
        .maybeSingle());
    }

    if (error) {
      console.error("register.request_access insert failed", {
        code: (error as any).code || null,
        message: (error as any).message || null,
        details: (error as any).details || null,
        hint: (error as any).hint || null,
      });
      const message = String((error as any).message || "").toLowerCase();
      const duplicate =
        (error as any).code === "23505" ||
        message.includes("idx_access_requests_pending_email_unique") ||
        message.includes("duplicate key");

      if (duplicate) {
        await logLegalConsent({
          accessRequestId: null,
          email,
          locale: preferredLanguage,
          source: "register_request",
        });
        return data<ActionData>({ success: true, type: "lead_created", alreadyPending: true });
      }

      return data<ActionData>({ errorKey: "register.error.submit_failed" }, { status: 500 });
    }

    await logLegalConsent({
      accessRequestId: insertedRequest?.id || null,
      email,
      locale: preferredLanguage,
      source: "register_request",
    });

    return data<ActionData>({ success: true, type: "lead_created" });
  }

  return data<ActionData>({ errorKey: "register.error.invalid_action" }, { status: 400 });
}

export default function Register() {
  const { t, locale } = useI18n();
  const { detectedLocale } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const countries = getSupportedCountries(locale);
  const { minDob, maxDob } = useMemo(() => getDobBounds(), []);
  const localeLabels = useMemo(() => getLocaleLabelsForUi(locale), [locale]);
  const [countryValue, setCountryValue] = useState("");
  const [languageValue, setLanguageValue] = useState<SupportedLocale>(detectedLocale);
  const [languageTouched, setLanguageTouched] = useState(false);
  const [dateOfBirthDigits, setDateOfBirthDigits] = useState("");
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const datePickerRef = useRef<HTMLInputElement | null>(null);
  const dobCaretModeRef = useRef<"forward" | "backward">("forward");
  const selectedCountry = useMemo(() => resolveSupportedCountry(countryValue, locale), [countryValue, locale]);
  const phonePrefix = selectedCountry ? getDialingPrefix(selectedCountry.code) : "+--";
  const isUsDobFormat = countryValue === "US";
  const dobHint = isUsDobFormat ? t("join_referral.dob_hint_us") : t("join_referral.dob_hint_default");
  const dobMask = "__/__/____";
  const dobDigitSlots = [0, 1, 3, 4, 6, 7, 8, 9];
  const submitFailedErrorKey = "register.error.submit_failed" as const;
  const isLeadCreated = Boolean(
    actionData && "success" in actionData && actionData.success && actionData.type === "lead_created"
  );
  const isSubmitFailed = Boolean(
    actionData && "errorKey" in actionData && actionData.errorKey === submitFailedErrorKey
  );
  const showResultOverlay = isLeadCreated || isSubmitFailed;
  const inlineErrorKey =
    actionData &&
    "errorKey" in actionData &&
    actionData.errorKey &&
    actionData.errorKey !== submitFailedErrorKey
      ? actionData.errorKey
      : null;
  const overlayMessage = isLeadCreated
    ? actionData && "type" in actionData && actionData.type === "lead_created" && actionData.alreadyPending
      ? t("register.success.pending")
      : t("register.success.received")
    : isSubmitFailed
      ? t(submitFailedErrorKey)
      : "";

  const formatDobForDisplay = (isoDate: string) => {
    const match = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return "";
    const year = match[1];
    const month = match[2];
    const day = match[3];
    return isUsDobFormat ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
  };
  const formatDobMaskedValue = (digits: string) => {
    const chars = dobMask.split("");
    const limitedDigits = digits.slice(0, 8);
    for (let i = 0; i < limitedDigits.length; i += 1) {
      chars[dobDigitSlots[i]] = limitedDigits[i];
    }
    return chars.join("");
  };
  const parseDobDigitsToIso = (digits: string) => {
    if (digits.length !== 8) return "";
    const first = Number.parseInt(digits.slice(0, 2), 10);
    const second = Number.parseInt(digits.slice(2, 4), 10);
    const year = Number.parseInt(digits.slice(4, 8), 10);
    if (!Number.isFinite(first) || !Number.isFinite(second) || !Number.isFinite(year)) return "";
    const day = isUsDobFormat ? second : first;
    const month = isUsDobFormat ? first : second;
    const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const testDate = new Date(Date.UTC(year, month - 1, day));
    const isValid =
      testDate.getUTCFullYear() === year &&
      testDate.getUTCMonth() === month - 1 &&
      testDate.getUTCDate() === day;
    if (!isValid) return "";
    if (iso < minDob || iso > maxDob) return "";
    return iso;
  };
  const getDobCaretPosition = (digitCount: number, mode: "forward" | "backward" = "forward") => {
    const capped = Math.max(0, Math.min(digitCount, 8));
    if (capped >= dobDigitSlots.length) return dobMask.length;
    const nextSlot = dobDigitSlots[capped];
    return mode === "backward" ? nextSlot : nextSlot + 1;
  };
  const dateOfBirthIsoValue = parseDobDigitsToIso(dateOfBirthDigits);

  useEffect(() => {
    const input = dateInputRef.current;
    if (!input || document.activeElement !== input) return;
    const nextPosition = getDobCaretPosition(dateOfBirthDigits.length, dobCaretModeRef.current);
    input.setSelectionRange(nextPosition, nextPosition);
    dobCaretModeRef.current = "forward";
  }, [dateOfBirthDigits, isUsDobFormat]);

  return (
    <div className="min-h-full flex flex-col justify-start bg-white pt-1 pb-12 sm:pt-2 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-3xl">
        <Link to="/" className="flex justify-center" aria-label={t("register.go_home_aria")}>
          <img src="/logo225px.png" alt="Runoot" className="h-[4.5rem] w-auto sm:h-[5.5rem]" />
        </Link>
      </div>

      <div className="mt-4 sm:mx-auto sm:w-full sm:max-w-3xl">
        <div className="px-4 py-6 sm:px-2">
          <h1 className="text-center font-display text-3xl font-bold tracking-tight text-gray-900 underline decoration-accent-500 underline-offset-4">{t("register.title")}</h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t("register.subtitle")}
          </p>

          {inlineErrorKey && (
            <div className="mt-6 mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{t(inlineErrorKey)}</div>
          )}

          <div className="mt-6 rounded-3xl border border-brand-100 bg-[#ECF4FE] p-4">
            <h2 className="font-display text-lg font-semibold text-gray-900">{t("register.invite.title")}</h2>
            <p className="mt-1 text-sm text-gray-600">{t("register.invite.subtitle")}</p>
            <Form method="post" className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <input type="hidden" name="intent" defaultValue="use_invite" />
              <div className="w-full sm:max-w-[240px]">
                <label htmlFor="inviteCode" className="label">{t("register.invite.code_label")}</label>
                <input id="inviteCode" name="inviteCode" type="text" className="input w-full rounded-full bg-white" required />
              </div>
              <button type="submit" className="btn-primary rounded-full sm:mb-[1px]" disabled={isSubmitting}>
                {t("register.invite.cta")}
              </button>
            </Form>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t("register.or")}</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="rounded-3xl border border-brand-500 bg-white p-4 sm:p-5">
            <h2 className="font-display text-lg font-semibold text-gray-900">{t("register.request.title")}</h2>
            <p className="mt-1 text-sm text-gray-600">
              {t("register.request.subtitle")}
            </p>

            <Form method="post" className="mt-5 space-y-4 [&_.input]:border [&_.input]:border-solid [&_.input]:border-accent-500 [&_.input]:shadow-none [&_.input:focus]:border-brand-500 [&_.input:focus]:ring-brand-500/20">
              <input type="hidden" name="intent" defaultValue="request_access" />
              {/* Honeypot — hidden from real users, bots will fill it */}
              <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0, height: 0, overflow: "hidden" }}>
                <label htmlFor="website">Website</label>
                <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="label">{t("register.form.first_name")}</label>
                  <input id="firstName" name="firstName" type="text" autoComplete="given-name" className="input w-full rounded-full bg-white" required />
                </div>
                <div>
                  <label htmlFor="lastName" className="label">{t("register.form.last_name")}</label>
                  <input id="lastName" name="lastName" type="text" autoComplete="family-name" className="input w-full rounded-full bg-white" required />
                </div>
                <div>
                  <label htmlFor="email" className="label">{t("auth.email")}</label>
                  <input id="email" name="email" type="email" autoComplete="email" className="input w-full rounded-full bg-white" required />
                </div>
                <div>
                  <label htmlFor="country" className="label">{t("profile.form.country")}</label>
                  <select
                    id="country"
                    name="country"
                    className="input h-11 w-full rounded-full bg-white !pl-10"
                    style={{ textIndent: "0.45rem" }}
                    required
                    value={countryValue}
                    onChange={(event) => {
                      const nextCountryValue = event.target.value;
                      setCountryValue(nextCountryValue);
                      if (!languageTouched) {
                        const resolved = resolveSupportedCountry(nextCountryValue, locale);
                        if (resolved) {
                          setLanguageValue(getSuggestedLocaleForCountry(resolved.code, detectedLocale));
                        }
                      }
                    }}
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
                  <label htmlFor="city" className="label">{t("profile.form.city")}</label>
                  <input id="city" name="city" type="text" className="input w-full rounded-full bg-white !pl-4" required />
                </div>
                <div>
                  <label htmlFor="dateOfBirth" className="label">{t("register.form.date_of_birth")}</label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={dateInputRef}
                      id="dateOfBirth"
                      type="text"
                      inputMode="numeric"
                      autoComplete="bday"
                      required
                      value={formatDobMaskedValue(dateOfBirthDigits)}
                      onChange={(event) => {
                        const nextDigits = event.currentTarget.value.replace(/[^\d]/g, "").slice(0, 8);
                        dobCaretModeRef.current = nextDigits.length < dateOfBirthDigits.length ? "backward" : "forward";
                        setDateOfBirthDigits(nextDigits);
                      }}
                      onKeyDown={(event) => {
                        if (event.metaKey || event.ctrlKey || event.altKey) return;
                        if (/^\d$/.test(event.key)) {
                          event.preventDefault();
                          dobCaretModeRef.current = "forward";
                          setDateOfBirthDigits((current) => (current.length >= 8 ? current : `${current}${event.key}`));
                          return;
                        }
                        if (event.key === "Backspace" || event.key === "Delete") {
                          event.preventDefault();
                          dobCaretModeRef.current = "backward";
                          setDateOfBirthDigits((current) => current.slice(0, -1));
                          return;
                        }
                        if (event.key === "Tab" || event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") return;
                        if (event.key === "/") {
                          event.preventDefault();
                        }
                      }}
                      onPaste={(event) => {
                        event.preventDefault();
                        const pastedDigits = event.clipboardData.getData("text").replace(/[^\d]/g, "");
                        if (!pastedDigits) return;
                        dobCaretModeRef.current = "forward";
                        setDateOfBirthDigits((current) => `${current}${pastedDigits}`.slice(0, 8));
                      }}
                      onFocus={(event) => {
                        const nextPosition = getDobCaretPosition(dateOfBirthDigits.length, "forward");
                        event.currentTarget.setSelectionRange(nextPosition, nextPosition);
                      }}
                      onClick={(event) => {
                        const nextPosition = getDobCaretPosition(dateOfBirthDigits.length, "forward");
                        event.currentTarget.setSelectionRange(nextPosition, nextPosition);
                      }}
                      placeholder={dobHint}
                      className="input h-11 w-[10rem] rounded-full bg-white !pl-5 !text-[16px] !leading-[1.2]"
                    />
                    <input type="hidden" name="dateOfBirth" value={dateOfBirthIsoValue} readOnly />
                    <div className="relative h-11 w-11">
                      <input
                        ref={datePickerRef}
                        type="date"
                        aria-label={t("join_referral.open_calendar")}
                        min={minDob}
                        max={maxDob}
                        value={dateOfBirthIsoValue || maxDob}
                        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                        onChange={(event) => {
                          const isoValue = event.target.value;
                          if (!isoValue) return;
                          setDateOfBirthDigits(formatDobForDisplay(isoValue).replace(/[^\d]/g, "").slice(0, 8));
                        }}
                      />
                      <div className="pointer-events-none flex h-11 w-11 items-center justify-center rounded-full border border-accent-500 bg-white text-gray-600">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <p className="mt-1 ml-4 text-xs text-gray-500">{dobHint}</p>
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
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="language" className="label">{t("register.form.language")}</label>
                  <select
                    id="language"
                    name="language"
                    className="input h-11 w-full rounded-3xl bg-white pr-10 !pl-10"
                    style={{ textIndent: "0.45rem" }}
                    required
                    value={languageValue}
                    onChange={(event) => {
                      setLanguageTouched(true);
                      const nextValue = event.target.value as SupportedLocale;
                      if (isSupportedLocale(nextValue)) setLanguageValue(nextValue);
                    }}
                  >
                    {Object.entries(localeLabels).map(([langCode, label]) => (
                      <option key={langCode} value={langCode}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="note" className="label pl-4">{t("register.form.note")}</label>
                <textarea
                  id="note"
                  name="note"
                  rows={7}
                  className="input w-full resize-none rounded-2xl bg-white py-2"
                  placeholder={t("register.form.note_placeholder")}
                  maxLength={1000}
                  required
                />
              </div>

              <div className="space-y-2 sm:w-3/5 sm:mr-auto ml-2">
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" name="termsAccepted" required className="mt-0.5 h-[1.05rem] w-[1.05rem] rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                  <span>
                    {t("register.legal_accept_terms_prefix")}{" "}
                    <Link to="/terms" className="font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700">
                      {t("legal.terms_of_service")}
                    </Link>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" name="privacyAccepted" required className="mt-0.5 h-[1.05rem] w-[1.05rem] rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                  <span>
                    {t("register.legal_accept_privacy_prefix")}{" "}
                    <Link to="/privacy-policy" className="font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700">
                      {t("legal.privacy_policy")}
                    </Link>
                  </span>
                </label>
              </div>

              <div className="pt-8 flex justify-center">
                <button type="submit" className="btn-primary flex w-1/2 justify-center rounded-full" disabled={isSubmitting}>
                  {t("register.form.submit")}
                </button>
              </div>
            </Form>
          </div>

          <p className="mt-6 text-center text-sm text-gray-600">
            {t("auth.have_account")} <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500">{t("auth.sign_in")}</Link>
          </p>
          <div className="mt-4 text-center">
            <Link to="/" className="btn-secondary inline-flex items-center rounded-full">
              {t("register.back_home")}
            </Link>
          </div>
        </div>
      </div>

      {showResultOverlay && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-brand-500 bg-white p-6 text-center">
            <p className={`text-base ${isLeadCreated ? "text-green-700" : "text-red-700"}`}>{overlayMessage}</p>
            <div className="mt-6">
              <Link to="/" className="btn-primary inline-flex items-center justify-center rounded-full px-6">
                {t("register.back_home")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
