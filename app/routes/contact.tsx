import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { useLoaderData, useActionData, Form, useNavigation } from "react-router";
import { useEffect, useState } from "react";
import { useI18n } from "~/hooks/useI18n";
import { translate } from "~/lib/i18n";
import { resolveLocaleForRequest } from "~/lib/locale";
import { sendTemplatedEmail } from "~/lib/email/service.server";
import { getUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";
import { FooterLight } from "~/components/FooterLight";
import { SubjectDropdown } from "~/components/SubjectDropdown";

export const meta: MetaFunction = () => {
  return [{ title: "Contact Us - Runoot" }];
};

const ALLOWED_SUBJECTS = ["general", "bug", "feature", "partnership", "other"] as const;
type AllowedSubject = (typeof ALLOWED_SUBJECTS)[number];
const CONTACT_RATE_LIMIT_WINDOW_MINUTES = 15;
const CONTACT_RATE_LIMIT_MAX_MESSAGES = 3;
const CONTACT_MIN_SUBMIT_SECONDS = 5;

function extractEmailAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/<([^>]+)>/);
  return (match?.[1] || trimmed).trim() || null;
}

function isAllowedSubject(value: string | null): value is AllowedSubject {
  return !!value && ALLOWED_SUBJECTS.includes(value as AllowedSubject);
}

async function isRateLimited(userId: string | null, email: string | null) {
  const windowStart = new Date(Date.now() - CONTACT_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
  let query = supabaseAdmin
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .gte("created_at", windowStart);

  if (userId) {
    query = query.eq("user_id", userId);
  } else if (email) {
    query = query.eq("email", email);
  } else {
    return false;
  }

  const { count, error } = await query;
  if (error) {
    console.error("Contact rate-limit check failed:", error);
    return false;
  }

  return (count ?? 0) >= CONTACT_RATE_LIMIT_MAX_MESSAGES;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  const url = new URL(request.url);
  const requestedSubject = url.searchParams.get("subject");
  const defaultSubject = isAllowedSubject(requestedSubject) ? requestedSubject : "";
  return { user, defaultSubject, formStartedAt: Date.now() };
}

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function action({ request }: ActionFunctionArgs) {
  const user = await getUser(request);
  const locale = resolveLocaleForRequest(request, (user as any)?.preferred_language);
  const tServer = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const formData = await request.formData();

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const subject = (formData.get("subject") as string)?.trim();
  const message = (formData.get("message") as string)?.trim();
  const website = (formData.get("website") as string)?.trim();
  const formStartedAtRaw = (formData.get("form_started_at") as string)?.trim();

  // Honeypot: bots often fill hidden fields. Silently accept to avoid signal.
  if (website) {
    return data({ success: true });
  }

  const formStartedAt = Number(formStartedAtRaw);
  const minElapsedMs = CONTACT_MIN_SUBMIT_SECONDS * 1000;
  if (!Number.isFinite(formStartedAt) || Date.now() - formStartedAt < minElapsedMs) {
    return data(
      { error: tServer("contact.error.failed_send"), resetForm: true, formStartedAt: Date.now() },
      { status: 400 }
    );
  }

  // Validation for non-logged-in users
  if (!user) {
    if (!name || name.length < 2) {
      return data({ error: tServer("contact.error.name_min"), field: "name" }, { status: 400 });
    }

    if (!email) {
      return data({ error: tServer("contact.error.email_required"), field: "email" }, { status: 400 });
    }

    // Validate email format with regex
    if (!emailRegex.test(email)) {
      return data({ error: tServer("contact.error.email_invalid"), field: "email" }, { status: 400 });
    }
  }

  // Validate subject
  if (!subject || !isAllowedSubject(subject)) {
    return data({ error: tServer("contact.error.subject_required"), field: "subject" }, { status: 400 });
  }

  // Validate message
  if (!message || message.length < 10) {
    return data({ error: tServer("contact.error.message_min"), field: "message" }, { status: 400 });
  }

  const requesterId = user ? (user as any).id ?? null : null;
  const requesterEmail = user ? ((user as any).email as string | null) : email;
  if (await isRateLimited(requesterId, requesterEmail ?? null)) {
    return data({ error: tServer("contact.error.rate_limited") }, { status: 429 });
  }

  // Save to database
  const { error } = await supabaseAdmin.from("contact_messages").insert({
    user_id: user ? (user as any).id : null,
    name: user ? (user as any).full_name : name,
    email: user ? (user as any).email : email,
    subject: subject,
    message: message,
  } as any);

  if (error) {
    console.error("Contact form error:", error);
    return data({ error: tServer("contact.error.failed_send") }, { status: 500 });
  }

  const contactInbox = extractEmailAddress(
    process.env.CONTACT_NOTIFICATION_EMAIL ||
    process.env.SUPPORT_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    null
  );

  if (contactInbox) {
    const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
    const senderName = user ? ((user as any).full_name as string | null) || "Registered user" : name || "Guest user";
    const senderEmail = user ? ((user as any).email as string | null) || "unknown" : email || "unknown";
    const senderUserId = user ? ((user as any).id as string | null) : null;
    const normalizedSubject = subject || "other";

    const emailResult = await sendTemplatedEmail({
      to: contactInbox,
      templateId: "platform_notification",
      locale: "en",
      payload: {
        title: `New contact message (${normalizedSubject})`,
        message: [
          `Name: ${senderName}`,
          `Email: ${senderEmail}`,
          senderUserId ? `User ID: ${senderUserId}` : "User ID: guest",
          `Subject: ${normalizedSubject}`,
          "",
          "Message:",
          message,
        ].join("\n"),
        ctaLabel: "Open contact page",
        ctaUrl: `${appUrl}/contact`,
      },
    });

    if (!emailResult.ok) {
      console.error("Contact email notification failed:", emailResult.error);
    }
  } else {
    console.warn("Contact email notification skipped: no CONTACT_NOTIFICATION_EMAIL/SUPPORT_EMAIL/RESEND_FROM_EMAIL configured.");
  }

  return data({ success: true });
}

export default function Contact() {
  const { t } = useI18n();
  const { user, defaultSubject, formStartedAt: initialFormStartedAt } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [subject, setSubject] = useState(defaultSubject);
  const [formKey, setFormKey] = useState(0);
  const [formStartedAt, setFormStartedAt] = useState(initialFormStartedAt);

  const isSubmitting = navigation.state === "submitting";

  useEffect(() => {
    if (actionData && "resetForm" in actionData && actionData.resetForm) {
      const nextFormStartedAt =
        "formStartedAt" in actionData && typeof actionData.formStartedAt === "number"
          ? actionData.formStartedAt
          : Date.now();
      setFormKey((prev) => prev + 1);
      setSubject(defaultSubject);
      setFormStartedAt(nextFormStartedAt);
    }
  }, [actionData, defaultSubject]);

  return (
    <div className="min-h-screen bg-[url('/contact.jpg')] bg-cover bg-center bg-fixed">
      <div className="min-h-screen bg-[#ECF4FE]/40 flex flex-col">
        <Header user={user} />

        <main className="mx-auto max-w-2xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8 flex-1 w-full">
          {/* Back button */}
          <button
            type="button"
            onClick={() => window.history.back()}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t("contact.back")}
          </button>

          {actionData && "success" in actionData ? (
            <div className="card rounded-3xl p-8 text-center shadow-md bg-white/70 backdrop-blur-sm">
              <h1 className="font-display text-3xl font-bold text-gray-900">
                {t("contact.title")}
              </h1>
              <p className="mt-2 text-gray-600">
                {t("contact.subtitle")}
              </p>
              <svg
                className="mx-auto mt-6 h-16 w-16 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h2 className="mt-4 text-xl font-semibold text-gray-900">
                {t("contact.thank_you")}
              </h2>
              <p className="mt-2 text-gray-600">
                {t("contact.received")}
              </p>
              <a href="/" className="mt-6 btn-primary rounded-full inline-block">
                {t("contact.back_home")}
              </a>
            </div>
          ) : (
            <div className="card rounded-3xl p-6 shadow-md bg-white/70 backdrop-blur-sm">
              <h1 className="font-display text-3xl font-bold text-gray-900">
                {t("contact.title")}
              </h1>
              <p className="mt-2 text-gray-600">
                {t("contact.subtitle")}
              </p>

              {actionData && "error" in actionData && (
                <div className="mb-6 mt-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
                  {actionData.error}
                </div>
              )}

              <Form key={formKey} method="post" className="mt-6 space-y-6">
                <div className="sr-only" aria-hidden="true">
                  <label htmlFor="website">Website</label>
                  <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
                </div>
                <input type="hidden" name="form_started_at" value={formStartedAt} />

                {/* Name - only for non-logged-in users */}
                {!user && (
                  <div>
                    <label className="label">{t("contact.name")} *</label>
                    <input
                      type="text"
                      name="name"
                      className="input shadow-sm"
                      placeholder={t("contact.name_placeholder")}
                      required
                      minLength={2}
                    />
                  </div>
                )}

                {/* Email - only for non-logged-in users */}
                {!user && (
                  <div>
                    <label className="label">{t("contact.email")} *</label>
                    <input
                      type="email"
                      name="email"
                      className="input shadow-sm"
                      placeholder={t("contact.email_placeholder")}
                      required
                    />
                  </div>
                )}

                {/* Subject - always shown */}
                <SubjectDropdown
                  value={subject}
                  onChange={setSubject}
                  hasError={!!(actionData && "field" in actionData && actionData.field === "subject")}
                />

                {/* Message - always shown */}
                <div>
                  <label className="label text-base mb-6">{t("contact.message")} *</label>
                  <textarea
                    name="message"
                    rows={5}
                    className="input shadow-md"
                    placeholder={t("contact.message_placeholder")}
                    required
                    minLength={10}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    {t("contact.message_min")}
                  </p>
                </div>

                {/* Submit */}
                <div>
                  <button
                    type="submit"
                    className="btn-primary rounded-full px-7 py-2 shadow-lg shadow-accent-500/30"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? t("contact.sending") : t("contact.send_message")}
                  </button>
                </div>
              </Form>
            </div>
          )}
        </main>

        <FooterLight />
      </div>
    </div>
  );
}
