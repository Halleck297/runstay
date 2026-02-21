import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { EmailLocale, RenderedEmailTemplate } from "../types";

const copy = {
  en: {
    title: "You have been invited to join a Team on Runoot.",
    intro: "invited you to join their Team on Runoot.",
    cta: "Accept team invitation",
    fallback: "If the button does not work, copy and paste this link into your browser:",
    footer: "You are receiving this email because a Team Leader invited you to join their team on Runoot.",
  },
  it: {
    title: "Sei stato invitato a entrare in un Team su Runoot.",
    intro: "ti ha invitato a entrare nel suo Team su Runoot.",
    cta: "Accetta invito al team",
    fallback: "Se il pulsante non funziona, copia e incolla questo link nel browser:",
    footer: "Ricevi questa email perche un Team Leader ti ha invitato nel suo team su Runoot.",
  },
  de: {
    title: "Du wurdest eingeladen, einem Team auf Runoot beizutreten.",
    intro: "hat dich eingeladen, seinem Team auf Runoot beizutreten.",
    cta: "Team-Einladung annehmen",
    fallback: "Wenn der Button nicht funktioniert, kopiere diesen Link in deinen Browser:",
    footer: "Sie erhalten diese E-Mail, weil ein Team Leader Sie in sein Team auf Runoot eingeladen hat.",
  },
  fr: {
    title: "Vous avez ete invite a rejoindre une equipe sur Runoot.",
    intro: "vous a invite a rejoindre son equipe sur Runoot.",
    cta: "Accepter l'invitation d'equipe",
    fallback: "Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :",
    footer: "Vous recevez cet e-mail car un Team Leader vous a invite a rejoindre son equipe sur Runoot.",
  },
  es: {
    title: "Has sido invitado a unirte a un equipo en Runoot.",
    intro: "te ha invitado a unirte a su equipo en Runoot.",
    cta: "Aceptar invitacion al equipo",
    fallback: "Si el boton no funciona, copia y pega este enlace en tu navegador:",
    footer: "Recibes este correo porque un Team Leader te invito a unirte a su equipo en Runoot.",
  },
} as const;

export interface TeamReferralInvitePayload {
  inviterName: string;
  acceptLink: string;
  personalMessage?: string | null;
}

export function renderTeamReferralInviteTemplate(
  payload: TeamReferralInvitePayload,
  locale: EmailLocale
): RenderedEmailTemplate {
  const t = copy[locale] || copy.en;
  const inviterNameRaw = payload.inviterName || "A Team Leader";
  const inviterName = escapeHtml(inviterNameRaw);
  const acceptLink = escapeHtml(payload.acceptLink);
  const personalMessage = (payload.personalMessage || "").trim();

  const personalBlock = personalMessage
    ? `<div style="margin:12px 0;padding:12px;border-radius:8px;background:#f9fafb;border:1px solid #e5e7eb;">
         <p style="margin:0 0 6px;color:#6b7280;font-size:12px;font-weight:600;">Personal message from ${inviterName}</p>
         <p style="margin:0;color:#111827;">${escapeHtml(personalMessage)}</p>
       </div>`
    : "";

  const bodyHtml = `
    ${personalBlock}
    <p style="margin:14px 0 0;color:#6b7280;font-size:12px;">${escapeHtml(t.fallback)}</p>
    <p style="margin:4px 0 0;color:#6b7280;font-size:12px;word-break:break-all;">${acceptLink}</p>
  `.trim();

  return {
    subject: `${inviterNameRaw} invited you to join their Team`,
    html: renderBaseEmailLayout({
      locale,
      title: t.title,
      intro: `${inviterName} ${escapeHtml(t.intro)}`,
      bodyHtml,
      ctaLabel: t.cta,
      ctaUrl: payload.acceptLink,
      footerText: t.footer,
    }),
    text: [
      t.title,
      `${inviterNameRaw} ${t.intro}`,
      personalMessage ? `Personal message: ${personalMessage}` : null,
      `${t.fallback} ${payload.acceptLink}`,
    ].filter(Boolean).join("\n\n"),
  };
}
