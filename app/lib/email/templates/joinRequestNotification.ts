import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { EmailLocale, RenderedEmailTemplate } from "../types";

const copy = {
  en: {
    subject: "New request to join your team",
    title: "New join request",
    body: "{name} ({email}) would like to join your team.",
    cta: "View requests",
    footer:
      "You are receiving this email because you are a Team Leader on Runoot.",
  },
  it: {
    subject: "Nuova richiesta di adesione al tuo team",
    title: "Nuova richiesta di adesione",
    body: "{name} ({email}) vuole entrare a far parte del tuo team.",
    cta: "Visualizza richieste",
    footer:
      "Ricevi questa email perche sei un Team Leader su Runoot.",
  },
  de: {
    subject: "Neue Anfrage, deinem Team beizutreten",
    title: "Neue Beitrittsanfrage",
    body: "{name} ({email}) moechte deinem Team beitreten.",
    cta: "Anfragen ansehen",
    footer:
      "Sie erhalten diese E-Mail, weil Sie ein Team Leader auf Runoot sind.",
  },
  fr: {
    subject: "Nouvelle demande pour rejoindre votre equipe",
    title: "Nouvelle demande d'adhesion",
    body: "{name} ({email}) souhaite rejoindre votre equipe.",
    cta: "Voir les demandes",
    footer:
      "Vous recevez cet e-mail car vous etes Team Leader sur Runoot.",
  },
  es: {
    subject: "Nueva solicitud para unirse a tu equipo",
    title: "Nueva solicitud de union",
    body: "{name} ({email}) quiere unirse a tu equipo.",
    cta: "Ver solicitudes",
    footer:
      "Recibes este correo porque eres Team Leader en Runoot.",
  },
  nl: {
    subject: "Nieuw verzoek om lid te worden van je team",
    title: "Nieuw lidmaatschapsverzoek",
    body: "{name} ({email}) wil graag lid worden van je team.",
    cta: "Verzoeken bekijken",
    footer:
      "Je ontvangt deze e-mail omdat je Team Leader bent op Runoot.",
  },
  pt: {
    subject: "Nova solicitacao para entrar na sua equipe",
    title: "Nova solicitacao de adesao",
    body: "{name} ({email}) quer entrar na sua equipe.",
    cta: "Ver solicitacoes",
    footer:
      "Voce esta recebendo este e-mail porque e um Team Leader na Runoot.",
  },
} as const;

export interface JoinRequestNotificationPayload {
  requesterFirstName: string;
  requesterLastName: string;
  requesterEmail: string;
  dashboardLink: string;
}

export function renderJoinRequestNotificationTemplate(
  payload: JoinRequestNotificationPayload,
  locale: EmailLocale
): RenderedEmailTemplate {
  const t = copy[locale] || copy.en;
  const fullName = `${payload.requesterFirstName} ${payload.requesterLastName}`.trim();
  const bodyText = t.body
    .replace("{name}", fullName)
    .replace("{email}", payload.requesterEmail);

  const bodyHtml = `<p style="margin:0;color:#374151;">${escapeHtml(bodyText)}</p>`;

  return {
    subject: t.subject,
    html: renderBaseEmailLayout({
      locale,
      title: t.title,
      bodyHtml,
      ctaLabel: t.cta,
      ctaUrl: payload.dashboardLink,
      footerText: t.footer,
    }),
    text: [t.title, bodyText, `${t.cta}: ${payload.dashboardLink}`]
      .filter(Boolean)
      .join("\n\n"),
  };
}
