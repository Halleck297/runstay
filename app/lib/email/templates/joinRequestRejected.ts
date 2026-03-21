import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { EmailLocale, RenderedEmailTemplate } from "../types";

const copy = {
  en: {
    subject: "Update on your join request",
    title: "Join request update",
    body: "Your request to join {name}'s team was not accepted.",
    cta: "Visit Runoot",
    footer:
      "You are receiving this email because of your activity on Runoot.",
  },
  it: {
    subject: "Aggiornamento sulla tua richiesta",
    title: "Aggiornamento richiesta",
    body: "La tua richiesta di entrare nel team di {name} non e stata accettata.",
    cta: "Visita Runoot",
    footer:
      "Ricevi questa email per la tua attivita su Runoot.",
  },
  de: {
    subject: "Update zu deiner Beitrittsanfrage",
    title: "Aktualisierung der Beitrittsanfrage",
    body: "Deine Anfrage, dem Team von {name} beizutreten, wurde nicht angenommen.",
    cta: "Runoot besuchen",
    footer:
      "Sie erhalten diese E-Mail aufgrund Ihrer Aktivitaet auf Runoot.",
  },
  fr: {
    subject: "Mise a jour de votre demande",
    title: "Mise a jour de la demande",
    body: "Votre demande pour rejoindre l'equipe de {name} n'a pas ete acceptee.",
    cta: "Visiter Runoot",
    footer:
      "Vous recevez cet e-mail en raison de votre activite sur Runoot.",
  },
  es: {
    subject: "Actualizacion de tu solicitud",
    title: "Actualizacion de solicitud",
    body: "Tu solicitud para unirte al equipo de {name} no fue aceptada.",
    cta: "Visitar Runoot",
    footer:
      "Recibes este correo por tu actividad en Runoot.",
  },
  nl: {
    subject: "Update over je lidmaatschapsverzoek",
    title: "Update lidmaatschapsverzoek",
    body: "Je verzoek om lid te worden van het team van {name} is niet geaccepteerd.",
    cta: "Bezoek Runoot",
    footer:
      "Je ontvangt deze e-mail vanwege je activiteit op Runoot.",
  },
  pt: {
    subject: "Atualizacao sobre sua solicitacao",
    title: "Atualizacao de solicitacao",
    body: "Sua solicitacao para entrar na equipe de {name} nao foi aceita.",
    cta: "Visite a Runoot",
    footer:
      "Voce esta recebendo este e-mail por causa da sua atividade no Runoot.",
  },
} as const;

export interface JoinRequestRejectedPayload {
  teamLeaderName: string;
}

export function renderJoinRequestRejectedTemplate(
  payload: JoinRequestRejectedPayload,
  locale: EmailLocale
): RenderedEmailTemplate {
  const t = copy[locale] || copy.en;
  const bodyText = t.body.replace("{name}", payload.teamLeaderName);
  const bodyHtml = `<p style="margin:0;color:#374151;">${escapeHtml(bodyText)}</p>`;
  const appUrl = process.env.APP_URL || "https://runoot.com";

  return {
    subject: t.subject,
    html: renderBaseEmailLayout({
      locale,
      title: t.title,
      bodyHtml,
      ctaLabel: t.cta,
      ctaUrl: appUrl,
      footerText: t.footer,
    }),
    text: [t.title, bodyText, `${t.cta}: ${appUrl}`]
      .filter(Boolean)
      .join("\n\n"),
  };
}
