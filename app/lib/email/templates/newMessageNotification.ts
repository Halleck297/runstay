import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { EmailLocale, RenderedEmailTemplate } from "../types";

export interface NewMessageNotificationPayload {
  senderName: string;
  messagesUrl: string;
}

const copy = {
  en: {
    subject: "You have a new message on Runoot",
    title: "New message",
    intro: "sent you a message on Runoot.",
    body: "Click below to read it and reply.",
    cta: "Read message",
    fallback: "If the button does not work, click",
    footer: "You are receiving this email because you have an account on Runoot.",
  },
  it: {
    subject: "Hai un nuovo messaggio su Runoot",
    title: "Nuovo messaggio",
    intro: "ti ha scritto su Runoot.",
    body: "Clicca qui sotto per leggerlo e rispondere.",
    cta: "Leggi il messaggio",
    fallback: "Se il pulsante non funziona, fai clic",
    footer: "Ricevi questa email perché hai un account su Runoot.",
  },
  de: {
    subject: "Du hast eine neue Nachricht auf Runoot",
    title: "Neue Nachricht",
    intro: "hat dir eine Nachricht auf Runoot geschickt.",
    body: "Klicke unten, um sie zu lesen und zu antworten.",
    cta: "Nachricht lesen",
    fallback: "Wenn der Button nicht funktioniert, klicke",
    footer: "Du erhältst diese E-Mail, weil du ein Konto auf Runoot hast.",
  },
  fr: {
    subject: "Vous avez un nouveau message sur Runoot",
    title: "Nouveau message",
    intro: "vous a envoyé un message sur Runoot.",
    body: "Cliquez ci-dessous pour le lire et répondre.",
    cta: "Lire le message",
    fallback: "Si le bouton ne fonctionne pas, cliquez",
    footer: "Vous recevez cet e-mail car vous avez un compte sur Runoot.",
  },
  es: {
    subject: "Tienes un nuevo mensaje en Runoot",
    title: "Nuevo mensaje",
    intro: "te ha enviado un mensaje en Runoot.",
    body: "Haz clic abajo para leerlo y responder.",
    cta: "Leer mensaje",
    fallback: "Si el botón no funciona, haz clic",
    footer: "Recibes este correo porque tienes una cuenta en Runoot.",
  },
  nl: {
    subject: "Je hebt een nieuw bericht op Runoot",
    title: "Nieuw bericht",
    intro: "heeft je een bericht gestuurd op Runoot.",
    body: "Klik hieronder om het te lezen en te beantwoorden.",
    cta: "Bericht lezen",
    fallback: "Als de knop niet werkt, klik dan",
    footer: "Je ontvangt deze e-mail omdat je een account hebt op Runoot.",
  },
  pt: {
    subject: "Você tem uma nova mensagem no Runoot",
    title: "Nova mensagem",
    intro: "enviou-te uma mensagem no Runoot.",
    body: "Clique abaixo para ler e responder.",
    cta: "Ler mensagem",
    fallback: "Se o botão não funcionar, clique",
    footer: "Você recebe este e-mail porque tem uma conta no Runoot.",
  },
};

export function renderNewMessageNotificationTemplate(
  payload: NewMessageNotificationPayload,
  locale: EmailLocale
): RenderedEmailTemplate {
  const l = copy[locale] || copy.en;
  const safeName = escapeHtml(payload.senderName);
  const safeUrl = escapeHtml(payload.messagesUrl);

  const intro = `<strong>${safeName}</strong> ${escapeHtml(l.intro)}`;
  const bodyHtml = `<p style="margin:0;color:#374151;">${escapeHtml(l.body)}</p>`;

  const html = renderBaseEmailLayout({
    locale,
    title: l.title,
    intro,
    bodyHtml,
    ctaLabel: l.cta,
    ctaUrl: payload.messagesUrl,
    ctaFallbackText: l.fallback,
    footerText: l.footer,
  });

  const text = `${safeName} ${l.intro}\n\n${l.body}\n\n${l.cta}: ${payload.messagesUrl}\n\n${l.footer}`;

  return { subject: l.subject, html, text };
}
