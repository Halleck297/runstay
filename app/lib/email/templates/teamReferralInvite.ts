import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { EmailLocale, RenderedEmailTemplate } from "../types";

const copy = {
  en: {
    title: "You have been invited to join a Team.",
    intro: "invited you to join.",
    subjectSuffix: "invited you to join",
    defaultInviter: "A Team Leader",
    cta: "Accept invitation",
    fallback: "If the button does not work, copy and paste this link into your browser:",
    personalMessageLabel: "{name} says:",
    footer: "You are receiving this email because a Team Leader invited you to join their team on Runoot.",
  },
  it: {
    title: "Sei stato invitato a entrare in un Team su Runoot.",
    intro: "ti ha invitato a entrare nel suo Team su Runoot.",
    subjectSuffix: "ti ha invitato a entrare nel suo Team",
    defaultInviter: "Un Team Leader",
    cta: "Accetta invito al team",
    fallback: "Se il pulsante non funziona, copia e incolla questo link nel browser:",
    personalMessageLabel: "{name} dice:",
    footer: "Ricevi questa email perche un Team Leader ti ha invitato nel suo team su Runoot.",
  },
  de: {
    title: "Du wurdest eingeladen, einem Team auf Runoot beizutreten.",
    intro: "hat dich eingeladen, seinem Team auf Runoot beizutreten.",
    subjectSuffix: "hat dich eingeladen, seinem Team beizutreten",
    defaultInviter: "Ein Team Leader",
    cta: "Team-Einladung annehmen",
    fallback: "Wenn der Button nicht funktioniert, kopiere diesen Link in deinen Browser:",
    personalMessageLabel: "{name} sagt:",
    footer: "Sie erhalten diese E-Mail, weil ein Team Leader Sie in sein Team auf Runoot eingeladen hat.",
  },
  fr: {
    title: "Vous avez ete invite a rejoindre une equipe sur Runoot.",
    intro: "vous a invite a rejoindre son equipe sur Runoot.",
    subjectSuffix: "vous a invite a rejoindre son equipe",
    defaultInviter: "Un Team Leader",
    cta: "Accepter l'invitation d'equipe",
    fallback: "Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :",
    personalMessageLabel: "{name} dit :",
    footer: "Vous recevez cet e-mail car un Team Leader vous a invite a rejoindre son equipe sur Runoot.",
  },
  es: {
    title: "Has sido invitado a unirte a un equipo en Runoot.",
    intro: "te ha invitado a unirte a su equipo en Runoot.",
    subjectSuffix: "te ha invitado a unirte a su equipo",
    defaultInviter: "Un Team Leader",
    cta: "Aceptar invitacion al equipo",
    fallback: "Si el boton no funciona, copia y pega este enlace en tu navegador:",
    personalMessageLabel: "{name} dice:",
    footer: "Recibes este correo porque un Team Leader te invito a unirte a su equipo en Runoot.",
  },
  nl: {
    title: "Je bent uitgenodigd om je aan te sluiten bij een team op Runoot.",
    intro: "heeft je uitgenodigd om je aan te sluiten bij het team op Runoot.",
    subjectSuffix: "heeft je uitgenodigd om je bij het team aan te sluiten",
    defaultInviter: "Een Team Leader",
    cta: "Teamuitnodiging accepteren",
    fallback: "Als de knop niet werkt, kopieer en plak deze link in je browser:",
    personalMessageLabel: "{name} zegt:",
    footer: "Je ontvangt deze e-mail omdat een Team Leader je heeft uitgenodigd om je bij het team op Runoot aan te sluiten.",
  },
  pt: {
    title: "Voce foi convidado para entrar em um time na Runoot.",
    intro: "convidou voce para entrar no time na Runoot.",
    subjectSuffix: "convidou voce para entrar no time",
    defaultInviter: "Um Team Leader",
    cta: "Aceitar convite do time",
    fallback: "Se o botao nao funcionar, copie e cole este link no navegador:",
    personalMessageLabel: "{name} diz:",
    footer: "Voce esta recebendo este e-mail porque um Team Leader convidou voce para entrar no time na Runoot.",
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
  const inviterNameRaw = payload.inviterName || t.defaultInviter;
  const inviterName = escapeHtml(inviterNameRaw);
  const personalMessage = (payload.personalMessage || "").trim();
  const personalNameRaw = (payload.inviterName || "")
    .replace(/\bteam leader\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const personalMessageLabel = t.personalMessageLabel.includes("{name}")
    ? t.personalMessageLabel.replace("{name}", personalNameRaw || "Someone")
    : `${t.personalMessageLabel} ${personalNameRaw || "Someone"}`;

  const personalBlock = personalMessage
    ? `<div style="margin:14px 0;padding:14px;border-radius:24px;background:#ECF4FE;border:1px solid #d6e6fb;">
         <p style="margin:0 0 8px;color:#6b7280;font-size:12px;font-weight:600;">${escapeHtml(personalMessageLabel)}</p>
         <p style="margin:0;color:#111827;">${escapeHtml(personalMessage)}</p>
       </div>`
    : "";

  const bodyHtml = `
    ${personalBlock}
  `.trim();

  return {
    subject: `${inviterNameRaw} ${t.subjectSuffix}`,
    html: renderBaseEmailLayout({
      locale,
      title: t.title,
      intro: `${inviterName} ${escapeHtml(t.intro)}`,
      bodyHtml,
      ctaLabel: t.cta,
      ctaUrl: payload.acceptLink,
      ctaFallbackText: t.fallback,
      footerText: t.footer,
    }),
    text: [
      t.title,
      `${inviterNameRaw} ${t.intro}`,
      personalMessage ? `${personalMessageLabel} ${personalMessage}` : null,
      `${t.fallback} ${payload.acceptLink}`,
    ].filter(Boolean).join("\n\n"),
  };
}
