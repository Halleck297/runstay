import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { EmailLocale, RenderedEmailTemplate } from "../types";

const copy = {
  en: { title: "Reset your password", cta: "Set new password" },
  it: { title: "Reimposta la password", cta: "Imposta nuova password" },
  de: { title: "Passwort zuruecksetzen", cta: "Neues Passwort setzen" },
  fr: { title: "Reinitialisez votre mot de passe", cta: "Definir un nouveau mot de passe" },
  es: { title: "Restablece tu contrasena", cta: "Definir nueva contrasena" },
} as const;

export interface PasswordResetPayload {
  resetLink: string;
}

export function renderPasswordResetTemplate(
  payload: PasswordResetPayload,
  locale: EmailLocale
): RenderedEmailTemplate {
  const t = copy[locale] || copy.en;
  const resetLink = escapeHtml(payload.resetLink);

  const bodyHtml = `
    <p style="margin:0;color:#374151;">For security, this link should be used as soon as possible.</p>
    <p style="margin:14px 0 0;color:#6b7280;font-size:12px;word-break:break-all;">${resetLink}</p>
  `.trim();

  return {
    subject: t.title,
    html: renderBaseEmailLayout({
      locale,
      title: t.title,
      bodyHtml,
      ctaLabel: t.cta,
      ctaUrl: payload.resetLink,
    }),
    text: `${t.title}\n\n${payload.resetLink}`,
  };
}
