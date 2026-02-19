export type EmailLocale = "en" | "it" | "de" | "fr" | "es";

export type EmailTemplateId =
  | "referral_invite"
  | "password_reset"
  | "platform_notification";

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
  return "en";
}
