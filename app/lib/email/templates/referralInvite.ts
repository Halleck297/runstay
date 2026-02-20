import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { EmailLocale, RenderedEmailTemplate } from "../types";

const copy = {
  en: {
    title: "You have been invited to join Runoot.",
    intro: "invited you to become part of his team.",
    cta: "Accept your invitation",
    fallback: "If the button does not work, copy and paste this link into your browser:",
    description:
      "Runoot is a platform built for runners - a private space to connect and securely exchange race bibs, hotel bookings, and race packages when plans change.",
    joinLine:
      "Join the team to stay connected and manage your race opportunities within a trusted community.",
    footer:
      "You are receiving this email because someone invited you to join Runoot.",
  },
  it: {
    title: "Sei invitato su Runoot",
    intro: "Un Team Leader ti ha invitato nella sua community di corsa.",
    cta: "Accetta invito",
    fallback: "Se il pulsante non funziona, apri questo link:",
    invitedBy: "ti ha invitato nella sua community di corsa su Runoot.",
    footer:
      "Ricevi questa email perche qualcuno ti ha invitato a entrare in Runoot.",
  },
  de: {
    title: "Du bist zu Runoot eingeladen",
    intro: "Ein Team Leader hat dich in seine Lauf-Community eingeladen.",
    cta: "Einladung annehmen",
    fallback: "Wenn der Button nicht funktioniert, oeffne diesen Link:",
    invitedBy: "hat dich in seine Lauf-Community auf Runoot eingeladen.",
    footer:
      "Sie erhalten diese E-Mail, weil Sie zu Runoot eingeladen wurden.",
  },
  fr: {
    title: "Vous etes invite sur Runoot",
    intro: "Un Team Leader vous a invite dans sa communaute running.",
    cta: "Accepter l'invitation",
    fallback: "Si le bouton ne fonctionne pas, ouvrez ce lien :",
    invitedBy: "vous a invite dans sa communaute running sur Runoot.",
    footer:
      "Vous recevez cet e-mail car quelqu'un vous a invite a rejoindre Runoot.",
  },
  es: {
    title: "Estas invitado a Runoot",
    intro: "Un Team Leader te ha invitado a su comunidad de running.",
    cta: "Aceptar invitacion",
    fallback: "Si el boton no funciona, abre este enlace:",
    invitedBy: "te ha invitado a su comunidad de running en Runoot.",
    footer:
      "Recibes este correo porque alguien te ha invitado a unirte a Runoot.",
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
  const description = copy.en.description;
  const joinLine = copy.en.joinLine;
  const inviterNameRaw = payload.inviterName || "A Team Leader";
  const inviterName = escapeHtml(inviterNameRaw);
  const referralLink = escapeHtml(payload.referralLink);
  const bodyHtml = `
    <p style="margin:0 0 10px;color:#374151;">${escapeHtml(description)}</p>
    <p style="margin:0 0 10px;color:#374151;">${escapeHtml(joinLine)}</p>
    <p style="margin:14px 0 0;color:#6b7280;font-size:12px;">${escapeHtml(t.fallback)}</p>
    <p style="margin:4px 0 0;color:#6b7280;font-size:12px;word-break:break-all;">${referralLink}</p>
  `.trim();

  return {
    subject: "Runoot invitation",
    html: renderBaseEmailLayout({
      locale,
      title: t.title,
      intro: `${inviterName} ${escapeHtml(t.intro)}`,
      bodyHtml,
      ctaLabel: t.cta,
      ctaUrl: payload.referralLink,
      footerText: t.footer,
    }),
    text: [
      t.title,
      `${inviterNameRaw} ${t.intro}`,
      description,
      joinLine,
      `${t.fallback} ${payload.referralLink}`,
    ].filter(Boolean).join("\n\n"),
  };
}
