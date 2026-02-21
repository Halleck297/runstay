import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { EmailLocale, RenderedEmailTemplate } from "../types";

const copy = {
  en: {
    title: "Your Runoot account is ready",
    intro: "A Runoot admin created your account.",
    cta: "Set your password",
  },
  it: {
    title: "Il tuo account Runoot e pronto",
    intro: "Un admin Runoot ha creato il tuo account.",
    cta: "Imposta la password",
  },
  de: {
    title: "Ihr Runoot-Konto ist bereit",
    intro: "Ein Runoot-Admin hat Ihr Konto erstellt.",
    cta: "Passwort festlegen",
  },
  fr: {
    title: "Votre compte Runoot est pret",
    intro: "Un admin Runoot a cree votre compte.",
    cta: "Definir le mot de passe",
  },
  es: {
    title: "Tu cuenta de Runoot esta lista",
    intro: "Un admin de Runoot ha creado tu cuenta.",
    cta: "Configurar contrasena",
  },
} as const;

export interface AccountSetupPayload {
  setupLink: string;
}

export function renderAccountSetupTemplate(
  payload: AccountSetupPayload,
  locale: EmailLocale
): RenderedEmailTemplate {
  const t = copy[locale] || copy.en;
  const safeLink = escapeHtml(payload.setupLink);

  const bodyHtml = `
    <p style="margin:0;color:#374151;">${escapeHtml(t.intro)}</p>
    <p style="margin:14px 0 0;color:#6b7280;font-size:12px;word-break:break-all;">${safeLink}</p>
  `.trim();

  return {
    subject: t.title,
    html: renderBaseEmailLayout({
      locale,
      title: t.title,
      bodyHtml,
      ctaLabel: t.cta,
      ctaUrl: payload.setupLink,
    }),
    text: `${t.title}\n\n${t.intro}\n\n${payload.setupLink}`,
  };
}
