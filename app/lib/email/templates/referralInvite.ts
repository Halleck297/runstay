import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { EmailLocale, RenderedEmailTemplate } from "../types";

const copy = {
  en: {
    title: "You are invited to Runoot",
    intro: "A Team Leader invited you to join their running community.",
    cta: "Accept invitation",
    fallback: "If the button does not work, open this link:",
    invitedBy: "invited you to join their running community on Runoot.",
  },
  it: {
    title: "Sei invitato su Runoot",
    intro: "Un Team Leader ti ha invitato nella sua community di corsa.",
    cta: "Accetta invito",
    fallback: "Se il pulsante non funziona, apri questo link:",
    invitedBy: "ti ha invitato nella sua community di corsa su Runoot.",
  },
  de: {
    title: "Du bist zu Runoot eingeladen",
    intro: "Ein Team Leader hat dich in seine Lauf-Community eingeladen.",
    cta: "Einladung annehmen",
    fallback: "Wenn der Button nicht funktioniert, oeffne diesen Link:",
    invitedBy: "hat dich in seine Lauf-Community auf Runoot eingeladen.",
  },
  fr: {
    title: "Vous etes invite sur Runoot",
    intro: "Un Team Leader vous a invite dans sa communaute running.",
    cta: "Accepter l'invitation",
    fallback: "Si le bouton ne fonctionne pas, ouvrez ce lien :",
    invitedBy: "vous a invite dans sa communaute running sur Runoot.",
  },
  es: {
    title: "Estas invitado a Runoot",
    intro: "Un Team Leader te ha invitado a su comunidad de running.",
    cta: "Aceptar invitacion",
    fallback: "Si el boton no funciona, abre este enlace:",
    invitedBy: "te ha invitado a su comunidad de running en Runoot.",
  },
} as const;

export interface ReferralInvitePayload {
  inviterName: string;
  referralLink: string;
  welcomeMessage?: string | null;
}

export function renderReferralInviteTemplate(
  payload: ReferralInvitePayload,
  locale: EmailLocale
): RenderedEmailTemplate {
  const t = copy[locale] || copy.en;
  const inviterNameRaw = payload.inviterName || "A Team Leader";
  const inviterName = escapeHtml(inviterNameRaw);
  const referralLink = escapeHtml(payload.referralLink);
  const welcomeMessage = (payload.welcomeMessage || "").trim();

  const customMessageBlock = welcomeMessage
    ? `<div style=\"margin:14px 0;padding:12px;border-radius:8px;background:#f3f4f6;color:#111827;\"><p style=\"margin:0;font-style:italic;\">${escapeHtml(welcomeMessage)}</p></div>`
    : "";

  const bodyHtml = `
    <p style="margin:0 0 10px;color:#374151;">${inviterName} ${escapeHtml(t.invitedBy)}</p>
    ${customMessageBlock}
    <p style="margin:14px 0 0;color:#6b7280;font-size:12px;">${escapeHtml(t.fallback)}</p>
    <p style="margin:4px 0 0;color:#6b7280;font-size:12px;word-break:break-all;">${referralLink}</p>
  `.trim();

  return {
    subject: `${inviterNameRaw} invited you to Runoot`,
    html: renderBaseEmailLayout({
      locale,
      title: t.title,
      intro: t.intro,
      bodyHtml,
      ctaLabel: t.cta,
      ctaUrl: payload.referralLink,
    }),
    text: [
      t.title,
      `${inviterNameRaw} ${t.invitedBy}`,
      welcomeMessage ? `Message: ${welcomeMessage}` : null,
      `${t.fallback} ${payload.referralLink}`,
    ].filter(Boolean).join("\n\n"),
  };
}
