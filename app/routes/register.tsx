import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { useMemo, useState } from "react";
import { useI18n } from "~/hooks/useI18n";
import { getLocaleLabelsForUi, isSupportedLocale, resolveLocaleForRequest, type SupportedLocale } from "~/lib/locale";
import { getDialingPrefix, getSuggestedLocaleForCountry, getSupportedCountries, resolveSupportedCountry } from "~/lib/supportedCountries";
import { getUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { getDefaultAppPath } from "~/lib/user-access";
import { translate } from "~/lib/i18n";

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
  min.setFullYear(min.getFullYear() - 80);
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

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (user) {
    return redirect(getDefaultAppPath(user));
  }
  return { detectedLocale: resolveLocaleForRequest(request, null) };
}

type ActionData =
  | { errorKey: "register.error.invite_code_required" | "register.error.first_name_required" | "register.error.last_name_required" | "register.error.valid_email_required" | "register.error.country_required" | "register.error.country_unsupported" | "register.error.city_required" | "register.error.date_of_birth_required" | "register.error.date_of_birth_invalid" | "register.error.date_of_birth_too_young" | "register.error.date_of_birth_too_old" | "register.error.note_required" | "register.error.note_too_long" | "register.error.submit_failed" | "register.error.invalid_action"; field?: string }
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
    const firstName = String(formData.get("firstName") || "").trim();
    const lastName = String(formData.get("lastName") || "").trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const emailRaw = String(formData.get("email") || "").trim();
    const country = String(formData.get("country") || "").trim();
    const city = String(formData.get("city") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const dateOfBirth = String(formData.get("dateOfBirth") || "").trim();
    const note = String(formData.get("note") || "").trim();
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

    const email = normalizeEmail(emailRaw);

    const { error } = await (supabaseAdmin.from("access_requests" as any) as any).insert({
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
    });

    if (error) {
      const message = String((error as any).message || "").toLowerCase();
      const duplicate =
        (error as any).code === "23505" ||
        message.includes("idx_access_requests_pending_email_unique") ||
        message.includes("duplicate key");

      if (duplicate) {
        return data<ActionData>({ success: true, type: "lead_created", alreadyPending: true });
      }

      return data<ActionData>({ errorKey: "register.error.submit_failed" }, { status: 500 });
    }

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
  const selectedCountry = useMemo(() => resolveSupportedCountry(countryValue, locale), [countryValue, locale]);
  const phonePrefix = selectedCountry ? getDialingPrefix(selectedCountry.code) : "+--";

  return (
    <div className="min-h-full flex flex-col justify-start bg-[#ECF4FE] pt-1 pb-12 sm:pt-2 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-3xl">
        <Link to="/" className="flex justify-center" aria-label={t("register.go_home_aria")}>
          <img src="/logo.svg" alt="Runoot" className="h-32 w-auto sm:h-40" />
        </Link>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-3xl">
        <div className="rounded-3xl border border-gray-200 bg-white px-8 py-8 shadow-sm sm:px-14">
          <h1 className="text-center font-display text-3xl font-bold tracking-tight text-gray-900">{t("register.title")}</h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t("register.subtitle")}
          </p>

          {actionData && "errorKey" in actionData && actionData.errorKey && (
            <div className="mt-6 mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{t(actionData.errorKey)}</div>
          )}

          {actionData && "success" in actionData && actionData.success && actionData.type === "lead_created" && (
            <div className="mt-6 mb-6 rounded-lg bg-green-50 p-4 text-sm text-green-700">
              {actionData.alreadyPending
                ? t("register.success.pending")
                : t("register.success.received")}
            </div>
          )}

          <div className="mt-6 rounded-3xl border border-brand-100 bg-[#ECF4FE] p-4">
            <h2 className="font-display text-lg font-semibold text-gray-900">{t("register.invite.title")}</h2>
            <p className="mt-1 text-sm text-gray-600">{t("register.invite.subtitle")}</p>
            <Form method="post" className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <input type="hidden" name="intent" value="use_invite" />
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

          <div>
            <h2 className="font-display text-lg font-semibold text-gray-900">{t("register.request.title")}</h2>
            <p className="mt-1 text-sm text-gray-600">
              {t("register.request.subtitle")}
            </p>

            <Form method="post" className="mt-5 space-y-4">
              <input type="hidden" name="intent" value="request_access" />

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
                    className="input w-full rounded-full bg-white"
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
                      {t("profile.form.country")}
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
                  <input id="city" name="city" type="text" className="input w-full rounded-full bg-white" required />
                </div>
                <div>
                  <label htmlFor="dateOfBirth" className="label">{t("register.form.date_of_birth")}</label>
                  <input id="dateOfBirth" name="dateOfBirth" type="date" min={minDob} max={maxDob} className="input w-full rounded-full bg-white" required />
                </div>
                <div>
                  <label htmlFor="phone" className="label">{t("profile.form.phone_number")}</label>
                  <div className="flex items-stretch">
                    <span className="shrink-0 rounded-r-none rounded-l-full bg-gray-100 px-3 py-2.5 text-sm text-gray-700 flex items-center justify-center border-none border-r-0 shadow-[0_2px_8px_rgba(0,0,0,0.15)] md:px-4 min-w-[72px]">
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
                    className="input w-full rounded-3xl bg-white pr-10"
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
                <label htmlFor="note" className="label">{t("register.form.note")}</label>
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
    </div>
  );
}
