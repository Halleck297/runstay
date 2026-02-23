import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { EmailLocale, RenderedEmailTemplate } from "../types";

const copy = {
  en: {
    title: "Reset your password",
    cta: "Set new password",
    body: "For security, this link should be used as soon as possible.",
  },
  it: {
    title: "Reimposta la password",
    cta: "Imposta nuova password",
    body: "Per sicurezza, usa questo link il prima possibile.",
  },
  de: {
    title: "Passwort zuruecksetzen",
    cta: "Neues Passwort setzen",
    body: "Aus Sicherheitsgruenden sollte dieser Link so schnell wie moglich verwendet werden.",
  },
  fr: {
    title: "Reinitialisez votre mot de passe",
    cta: "Definir un nouveau mot de passe",
    body: "Pour des raisons de securite, utilisez ce lien des que possible.",
  },
  es: {
    title: "Restablece tu contrasena",
    cta: "Definir nueva contrasena",
    body: "Por seguridad, usa este enlace lo antes posible.",
  },
  nl: {
    title: "Stel je wachtwoord opnieuw in",
    cta: "Nieuw wachtwoord instellen",
    body: "Gebruik deze link om veiligheidsredenen zo snel mogelijk.",
  },
  pt: {
    title: "Redefina sua senha",
    cta: "Definir nova senha",
    body: "Por seguranca, use este link o quanto antes.",
  },
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
    <p style="margin:0;color:#374151;">${escapeHtml(t.body)}</p>
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
