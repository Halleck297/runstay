import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { useI18n } from "~/hooks/useI18n";
import { isSupportedLocale, LOCALE_LABELS, resolveLocaleForRequest } from "~/lib/locale";
import { getSupportedCountries, resolveSupportedCountry } from "~/lib/supportedCountries";
import { getUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { getDefaultAppPath } from "~/lib/user-access";

export const meta: MetaFunction = () => [{ title: "Join Runoot - Invite or Request Access" }];

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

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (user) {
    return redirect(getDefaultAppPath(user));
  }
  return { detectedLocale: resolveLocaleForRequest(request, null) };
}

type ActionData =
  | { error: string; field?: string }
  | { success: true; type: "invite_redirect" }
  | { success: true; type: "lead_created"; alreadyPending?: boolean };

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "use_invite") {
    const inviteCode = String(formData.get("inviteCode") || "").trim();
    if (!inviteCode) {
      return data<ActionData>({ error: "Invite code is required", field: "inviteCode" }, { status: 400 });
    }
    return redirect(`/join/${encodeURIComponent(inviteCode)}`);
  }

  if (intent === "request_access") {
    const fullName = String(formData.get("fullName") || "").trim();
    const emailRaw = String(formData.get("email") || "").trim();
    const country = String(formData.get("country") || "").trim();
    const city = String(formData.get("city") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const note = String(formData.get("note") || "").trim();
    const preferredLanguageRaw = String(formData.get("language") || "").trim().toLowerCase();
    const preferredLanguage = isSupportedLocale(preferredLanguageRaw)
      ? preferredLanguageRaw
      : resolveLocaleForRequest(request, null);
    const resolvedCountry = resolveSupportedCountry(country, preferredLanguage);

    if (!fullName || fullName.length < 2) {
      return data<ActionData>({ error: "Full name is required", field: "fullName" }, { status: 400 });
    }

    if (!emailRaw || !emailRegex.test(emailRaw)) {
      return data<ActionData>({ error: "A valid email is required", field: "email" }, { status: 400 });
    }

    if (!country) {
      return data<ActionData>({ error: "Country is required", field: "country" }, { status: 400 });
    }
    if (!resolvedCountry) {
      return data<ActionData>({ error: "Country not supported yet, contact support", field: "country" }, { status: 400 });
    }

    if (!city) {
      return data<ActionData>({ error: "City is required", field: "city" }, { status: 400 });
    }

    if (note.length > 1000) {
      return data<ActionData>({ error: "Message is too long (max 1000 chars)", field: "note" }, { status: 400 });
    }

    const email = normalizeEmail(emailRaw);

    const { error } = await (supabaseAdmin.from("access_requests" as any) as any).insert({
      full_name: fullName,
      email,
      country: resolvedCountry.nameEn,
      city: city || null,
      phone: phone || null,
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

      return data<ActionData>({ error: "Could not submit your request. Please try again." }, { status: 500 });
    }

    return data<ActionData>({ success: true, type: "lead_created" });
  }

  return data<ActionData>({ error: "Invalid action" }, { status: 400 });
}

export default function Register() {
  const { t, locale } = useI18n();
  const { detectedLocale } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ActionData | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const countries = getSupportedCountries(locale);

  return (
    <div className="min-h-full flex flex-col justify-start bg-[#ECF4FE] pt-1 pb-12 sm:pt-2 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-3xl">
        <Link to="/" className="flex justify-center" aria-label="Go to home">
          <img src="/logo.svg" alt="Runoot" className="h-32 w-auto sm:h-40" />
        </Link>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-3xl">
        <div className="rounded-3xl border border-gray-200 bg-white px-8 py-8 shadow-sm sm:px-14">
          <h1 className="text-center font-display text-3xl font-bold tracking-tight text-gray-900">join runoot</h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Access is currently invite-only. If you don't have an invite, request access below.
          </p>

          {actionData && "error" in actionData && actionData.error && (
            <div className="mt-6 mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{actionData.error}</div>
          )}

          {actionData && "success" in actionData && actionData.success && actionData.type === "lead_created" && (
            <div className="mt-6 mb-6 rounded-lg bg-green-50 p-4 text-sm text-green-700">
              {actionData.alreadyPending
                ? "You already have a pending access request. We will review it shortly."
                : "Request received. We will review your profile and contact you by email."}
            </div>
          )}

          <div className="mt-6 rounded-3xl border border-brand-100 bg-[#ECF4FE] p-4">
            <h2 className="font-display text-lg font-semibold text-gray-900">I have an invitation code</h2>
            <p className="mt-1 text-sm text-gray-600">Enter your code to continue registration.</p>
            <Form method="post" className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <input type="hidden" name="intent" value="use_invite" />
              <div className="flex-1">
                <label htmlFor="inviteCode" className="label">Invite code</label>
                <input id="inviteCode" name="inviteCode" type="text" className="input w-full rounded-full bg-white" placeholder="e.g. abc123" required />
              </div>
              <button type="submit" className="btn-primary rounded-full sm:mb-[1px]" disabled={isSubmitting}>
                Continue
              </button>
            </Form>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">or</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-gray-900">Request access</h2>
            <p className="mt-1 text-sm text-gray-600">
              No invite yet? Share your details and we will evaluate your request.
            </p>

            <Form method="post" className="mt-5 space-y-4">
              <input type="hidden" name="intent" value="request_access" />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="fullName" className="label">Full name</label>
                  <input id="fullName" name="fullName" type="text" autoComplete="name" className="input w-full rounded-full bg-[#ECF4FE]" required />
                </div>
                <div>
                  <label htmlFor="email" className="label">{t("auth.email")}</label>
                  <input id="email" name="email" type="email" autoComplete="email" className="input w-full rounded-full bg-[#ECF4FE]" required />
                </div>
                <div>
                  <label htmlFor="country" className="label">{t("profile.form.country")}</label>
                  <input
                    id="country"
                    name="country"
                    type="text"
                    list="register-country-list"
                    className="input w-full rounded-full bg-[#ECF4FE]"
                    required
                    autoComplete="off"
                  />
                  <datalist id="register-country-list">
                    {countries.map((countryOption) => (
                      <option key={countryOption.code} value={countryOption.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label htmlFor="city" className="label">{t("profile.form.city")}</label>
                  <input id="city" name="city" type="text" className="input w-full rounded-full bg-[#ECF4FE]" required />
                </div>
                <div>
                  <label htmlFor="phone" className="label">{t("profile.form.phone_number")}</label>
                  <input id="phone" name="phone" type="tel" autoComplete="tel" className="input w-full rounded-full bg-[#ECF4FE]" placeholder="+39 ..." />
                </div>
                <div>
                  <label htmlFor="language" className="label">Language</label>
                  <select id="language" name="language" className="input w-full rounded-full bg-[#ECF4FE]" required defaultValue={detectedLocale}>
                    {Object.entries(LOCALE_LABELS).map(([langCode, label]) => (
                      <option key={langCode} value={langCode}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="note" className="label">Message (optional)</label>
                <textarea
                  id="note"
                  name="note"
                  rows={4}
                  className="input w-full rounded-2xl bg-[#ECF4FE] py-2"
                  placeholder="Tell us briefly why you want to join Runoot"
                  maxLength={1000}
                />
              </div>

              <div className="pt-8 flex justify-center">
                <button type="submit" className="btn-primary flex w-1/2 justify-center rounded-full" disabled={isSubmitting}>
                  Send request
                </button>
              </div>
            </Form>
          </div>

          <p className="mt-6 text-center text-sm text-gray-600">
            {t("auth.have_account")} <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500">{t("auth.sign_in")}</Link>
          </p>
          <div className="mt-4 text-center">
            <Link to="/" className="btn-secondary inline-flex items-center rounded-full">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
