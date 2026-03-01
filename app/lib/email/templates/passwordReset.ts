import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { EmailLocale, RenderedEmailTemplate } from "../types";

const copy = {
  en: {
    title: "Reset your password",
    cta: "Reset password",
    greeting: "Hi {name},",
    validity: "This reset link is valid for {minutes} minutes.",
    fallback: "If the button does not work, copy and paste this link into your browser:",
  },
  it: {
    title: "Reimposta la password",
    cta: "Reimposta password",
    greeting: "Ciao {name},",
    validity: "Questo link di reset e valido per {minutes} minuti.",
    fallback: "Se il pulsante non funziona, copia e incolla questo link nel browser:",
  },
  de: {
    title: "Passwort zuruecksetzen",
    cta: "Passwort zuruecksetzen",
    greeting: "Hallo {name},",
    validity: "Dieser Reset-Link ist {minutes} Minuten gueltig.",
    fallback: "Wenn die Schaltflaeche nicht funktioniert, kopiere diesen Link in deinen Browser:",
  },
  fr: {
    title: "Reinitialisez votre mot de passe",
    cta: "Reinitialiser le mot de passe",
    greeting: "Bonjour {name},",
    validity: "Ce lien de reinitialisation est valide pendant {minutes} minutes.",
    fallback: "Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :",
  },
  es: {
    title: "Restablece tu contrasena",
    cta: "Restablecer contrasena",
    greeting: "Hola {name},",
    validity: "Este enlace de restablecimiento es valido durante {minutes} minutos.",
    fallback: "Si el boton no funciona, copia y pega este enlace en tu navegador:",
  },
  nl: {
    title: "Stel je wachtwoord opnieuw in",
    cta: "Wachtwoord resetten",
    greeting: "Hoi {name},",
    validity: "Deze resetlink is {minutes} minuten geldig.",
    fallback: "Als de knop niet werkt, kopieer en plak deze link in je browser:",
  },
  pt: {
    title: "Redefina sua senha",
    cta: "Redefinir senha",
    greeting: "Oi {name},",
    validity: "Este link de redefinicao e valido por {minutes} minutos.",
    fallback: "Se o botao nao funcionar, copie e cole este link no navegador:",
  },
} as const;

const DEFAULT_TOKEN_VALIDITY_MINUTES = 60;

function resolveTokenValidityMinutes(payloadMinutes?: number): number {
  if (Number.isFinite(payloadMinutes) && payloadMinutes && payloadMinutes > 0) {
    return Math.floor(payloadMinutes);
  }

  const raw = Number.parseInt(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || "", 10);
  if (Number.isFinite(raw) && raw > 0) return raw;

  return DEFAULT_TOKEN_VALIDITY_MINUTES;
}

export interface PasswordResetPayload {
  resetLink: string;
  name?: string;
  tokenValidityMinutes?: number;
}

export function renderPasswordResetTemplate(
  payload: PasswordResetPayload,
  locale: EmailLocale
): RenderedEmailTemplate {
  const t = copy[locale] || copy.en;
  const tokenValidityMinutes = resolveTokenValidityMinutes(payload.tokenValidityMinutes);
  const resetLink = escapeHtml(payload.resetLink);

  const intro = payload.name ? t.greeting.replace("{name}", payload.name) : undefined;
  const validityText = t.validity.replace("{minutes}", String(tokenValidityMinutes));

  const bodyHtml = `
    <p style="margin:0;color:#374151;">${escapeHtml(validityText)}</p>
  `.trim();

  return {
    subject: t.title,
    html: renderBaseEmailLayout({
      locale,
      title: t.title,
      intro,
      bodyHtml,
      ctaLabel: t.cta,
      ctaUrl: payload.resetLink,
      ctaCompact: true,
      ctaFallbackText: t.fallback,
    }),
    text: `${t.title}\n${intro ? `\n${intro}` : ""}\n\n${validityText}\n\n${payload.resetLink}`,
  };
}
