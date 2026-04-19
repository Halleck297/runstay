export type EmailLocale = "en" | "it" | "de" | "fr" | "es" | "nl" | "pt";

export type EmailTemplateId =
  | "referral_invite"
  | "ambassador_invite"
  | "password_reset"
  | "account_setup"
  | "platform_notification"
  | "join_request_notification"
  | "join_request_rejected"
  | "welcome_user";

export interface RenderedEmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function normalizeEmailLocale(locale?: string | null): EmailLocale {
  const normalized = (locale || "").toLowerCase();

  if (normalized.startsWith("it")) return "it";
  if (normalized.startsWith("de")) return "de";
  if (normalized.startsWith("fr")) return "fr";
  if (normalized.startsWith("es")) return "es";
  if (normalized.startsWith("nl")) return "nl";
  if (normalized.startsWith("pt")) return "pt";
  return "en";
}
