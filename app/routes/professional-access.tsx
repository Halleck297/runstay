import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { useMemo } from "react";
import { useI18n } from "~/hooks/useI18n";
import { getLocaleLabelsForUi, isSupportedLocale, resolveLocaleForRequest, type SupportedLocale } from "~/lib/locale";
import { getSupportedCountries, resolveSupportedCountry } from "~/lib/supportedCountries";
import { getUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { getDefaultAppPath } from "~/lib/user-access";
import { translate } from "~/lib/i18n";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[“”‘’"'`]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const locale = ((data as any)?.detectedLocale as SupportedLocale | undefined) || "en";
  return [{ title: translate(locale, "pro_access.meta_title") }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (user) return redirect(getDefaultAppPath(user));
  return { detectedLocale: resolveLocaleForRequest(request, null) };
}

type ActionData =
  | {
      errorKey:
        | "pro_access.error.full_name_required"
        | "pro_access.error.valid_email_required"
        | "pro_access.error.role_required"
        | "pro_access.error.country_required"
        | "pro_access.error.city_required"
        | "pro_access.error.message_required"
        | "pro_access.error.submit_failed";
      field?: string;
    }
  | { success: true; alreadyPending?: boolean };

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const fullName = String(formData.get("fullName") || "").trim();
  const emailRaw = String(formData.get("email") || "").trim();
  const company = String(formData.get("company") || "").trim();
  const role = String(formData.get("role") || "").trim();
  const country = String(formData.get("country") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const preferredLanguageRaw = String(formData.get("language") || "").trim().toLowerCase();
  const preferredLanguage = isSupportedLocale(preferredLanguageRaw)
    ? preferredLanguageRaw
    : resolveLocaleForRequest(request, null);
  const resolvedCountry = resolveSupportedCountry(country, preferredLanguage);

  if (!fullName || fullName.length < 2) {
    return data<ActionData>({ errorKey: "pro_access.error.full_name_required", field: "fullName" }, { status: 400 });
  }
  if (!emailRaw || !emailRegex.test(emailRaw)) {
    return data<ActionData>({ errorKey: "pro_access.error.valid_email_required", field: "email" }, { status: 400 });
  }
  if (!role || !["team_leader", "tour_operator", "agency"].includes(role)) {
    return data<ActionData>({ errorKey: "pro_access.error.role_required", field: "role" }, { status: 400 });
  }
  if (!country || !resolvedCountry) {
    return data<ActionData>({ errorKey: "pro_access.error.country_required", field: "country" }, { status: 400 });
  }
  if (!city) {
    return data<ActionData>({ errorKey: "pro_access.error.city_required", field: "city" }, { status: 400 });
  }
  if (!message || message.length < 20) {
    return data<ActionData>({ errorKey: "pro_access.error.message_required", field: "message" }, { status: 400 });
  }

  const email = normalizeEmail(emailRaw);
  const note = [
    `REQUEST_TYPE:professional_access`,
    `ROLE:${role}`,
    company ? `COMPANY:${company}` : null,
    "",
    message,
  ]
    .filter(Boolean)
    .join("\n");

  const { error } = await (supabaseAdmin.from("access_requests" as any) as any).insert({
    full_name: fullName,
    email,
    country: resolvedCountry.nameEn,
    city,
    preferred_language: preferredLanguage,
    note,
    source: "contact_form",
    status: "pending",
  });

  if (error) {
    const messageText = String((error as any).message || "").toLowerCase();
    const duplicate =
      (error as any).code === "23505" ||
      messageText.includes("idx_access_requests_pending_email_unique") ||
      messageText.includes("duplicate key");

    if (duplicate) return data<ActionData>({ success: true, alreadyPending: true });
    return data<ActionData>({ errorKey: "pro_access.error.submit_failed" }, { status: 500 });
  }

  return data<ActionData>({ success: true });
}

export default function ProfessionalAccessPage() {
  const { t, locale } = useI18n();
  const { detectedLocale } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const countries = getSupportedCountries(locale);
  const localeLabels = useMemo(() => getLocaleLabelsForUi(locale), [locale]);

  return (
    <div className="min-h-full flex flex-col justify-start bg-[#ECF4FE] pt-2 pb-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-3xl">
        <Link to="/" className="flex justify-center" aria-label={t("register.go_home_aria")}>
          <img src="/logo.svg" alt="Runoot" className="h-32 w-auto sm:h-40" />
        </Link>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-3xl">
        <div className="rounded-3xl border border-gray-200 bg-white px-8 py-8 shadow-sm sm:px-14">
          <h1 className="text-center font-display text-3xl font-bold tracking-tight text-gray-900">
            {t("pro_access.title")}
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t("pro_access.subtitle")}
          </p>

          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">{t("pro_access.disclaimer_title")}</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>{t("pro_access.disclaimer_item_1")}</li>
              <li>{t("pro_access.disclaimer_item_2")}</li>
              <li>{t("pro_access.disclaimer_item_3")}</li>
            </ul>
          </div>

          {actionData && "errorKey" in actionData && actionData.errorKey ? (
            <div className="mt-6 rounded-3xl bg-red-50 p-4 text-sm text-red-700">{t(actionData.errorKey)}</div>
          ) : null}

          {actionData && "success" in actionData && actionData.success ? (
            <div className="mt-6 rounded-3xl bg-green-50 p-4 text-sm text-green-700">
              {actionData.alreadyPending
                ? t("pro_access.success.pending")
                : t("pro_access.success.received")}
            </div>
          ) : null}

          <Form method="post" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="fullName" className="label">{t("pro_access.full_name_label")}</label>
                <input id="fullName" name="fullName" type="text" className="input w-full rounded-full bg-white" required />
              </div>
              <div>
                <label htmlFor="email" className="label">{t("auth.email")}</label>
                <input id="email" name="email" type="email" className="input w-full rounded-full bg-white" required />
              </div>
              <div>
                <label htmlFor="role" className="label">{t("pro_access.role_label")}</label>
                <select id="role" name="role" className="input w-full rounded-full bg-white" required>
                  <option value="">{t("pro_access.role_placeholder")}</option>
                  <option value="team_leader">{t("pro_access.role.team_leader")}</option>
                  <option value="tour_operator">{t("pro_access.role.tour_operator")}</option>
                  <option value="agency">{t("pro_access.role.agency")}</option>
                </select>
              </div>
              <div>
                <label htmlFor="company" className="label">{t("pro_access.company_label")}</label>
                <input id="company" name="company" type="text" className="input w-full rounded-full bg-white" />
              </div>
              <div>
                <label htmlFor="country" className="label">{t("profile.form.country")}</label>
                <select id="country" name="country" className="input w-full rounded-full bg-white" required>
                  <option value="">{t("pro_access.country_placeholder")}</option>
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="city" className="label">{t("profile.form.city")}</label>
                <input id="city" name="city" type="text" className="input w-full rounded-full bg-white" required />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="language" className="label">{t("register.form.language")}</label>
                <select id="language" name="language" className="input w-full rounded-full bg-white" required defaultValue={detectedLocale}>
                  {Object.entries(localeLabels).map(([langCode, label]) => (
                    <option key={langCode} value={langCode}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="message" className="label">{t("pro_access.message_label")}</label>
              <textarea
                id="message"
                name="message"
                rows={7}
                className="input w-full resize-none rounded-2xl bg-white py-2"
                placeholder={t("pro_access.message_placeholder")}
                maxLength={1500}
                required
              />
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <Link to="/register" className="btn-secondary rounded-full px-6 py-3">
                {t("pro_access.back")}
              </Link>
              <button type="submit" className="btn-primary rounded-full px-8 py-3" disabled={isSubmitting}>
                {t("pro_access.submit")}
              </button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
