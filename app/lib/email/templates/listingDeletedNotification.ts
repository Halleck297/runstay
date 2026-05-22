import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { EmailLocale, RenderedEmailTemplate } from "../types";

export interface ListingDeletedNotificationPayload {
  listingTitle: string;
  ownerName: string;
}

const copy = {
  en: {
    subject: "A listing from {ownerName} has been deleted",
    title: "Listing deleted",
    intro: "The listing from {ownerName} that you contacted on Runoot is no longer available.",
    listingLabel: "Listing",
    ownerLabel: "Published by",
    footer: "You are receiving this email because you had a conversation about this listing on Runoot.",
  },
  it: {
    subject: "Un annuncio di {ownerName} è stato eliminato",
    title: "Annuncio eliminato",
    intro: "L'annuncio di {ownerName} che avevi contattato su Runoot non è più disponibile.",
    listingLabel: "Annuncio",
    ownerLabel: "Pubblicato da",
    footer: "Ricevi questa email perché hai avuto una conversazione relativa a questo annuncio su Runoot.",
  },
  de: {
    subject: "Ein Inserat von {ownerName} wurde gelöscht",
    title: "Inserat gelöscht",
    intro: "Das Inserat von {ownerName}, den du auf Runoot kontaktiert hast, ist nicht mehr verfügbar.",
    listingLabel: "Inserat",
    ownerLabel: "Veröffentlicht von",
    footer: "Du erhältst diese E-Mail, weil du zu diesem Inserat eine Unterhaltung auf Runoot hattest.",
  },
  fr: {
    subject: "Une annonce de {ownerName} a été supprimée",
    title: "Annonce supprimée",
    intro: "L'annonce de {ownerName} que vous aviez contacté sur Runoot n'est plus disponible.",
    listingLabel: "Annonce",
    ownerLabel: "Publié par",
    footer: "Vous recevez cet e-mail car vous avez eu une conversation au sujet de cette annonce sur Runoot.",
  },
  es: {
    subject: "Se ha eliminado un anuncio de {ownerName}",
    title: "Anuncio eliminado",
    intro: "El anuncio de {ownerName} que contactaste en Runoot ya no está disponible.",
    listingLabel: "Anuncio",
    ownerLabel: "Publicado por",
    footer: "Recibes este correo porque tuviste una conversación sobre este anuncio en Runoot.",
  },
  nl: {
    subject: "Een listing van {ownerName} is verwijderd",
    title: "Listing verwijderd",
    intro: "De listing van {ownerName} waarmee je contact had op Runoot is niet langer beschikbaar.",
    listingLabel: "Listing",
    ownerLabel: "Gepubliceerd door",
    footer: "Je ontvangt deze e-mail omdat je een gesprek had over deze listing op Runoot.",
  },
  pt: {
    subject: "Um anúncio de {ownerName} foi eliminado",
    title: "Anúncio eliminado",
    intro: "O anúncio de {ownerName} que contactaste no Runoot já não está disponível.",
    listingLabel: "Anúncio",
    ownerLabel: "Publicado por",
    footer: "Recebes este email porque tiveste uma conversa sobre este anúncio no Runoot.",
  },
};

function interpolateOwner(value: string, ownerName: string): string {
  return value.replaceAll("{ownerName}", ownerName);
}

export function renderListingDeletedNotificationTemplate(
  payload: ListingDeletedNotificationPayload,
  locale: EmailLocale
): RenderedEmailTemplate {
  const l = copy[locale] || copy.en;
  const safeTitle = escapeHtml(payload.listingTitle || "Runoot listing");
  const ownerName = payload.ownerName || "Runoot user";
  const safeOwnerName = escapeHtml(ownerName);

  const details = [
    `<strong>${escapeHtml(l.listingLabel)}:</strong> ${safeTitle}`,
    `<strong>${escapeHtml(l.ownerLabel)}:</strong> ${safeOwnerName}`,
  ];

  const bodyHtml = `
    <p style="margin:0 0 18px;color:#374151;">${escapeHtml(interpolateOwner(l.intro, ownerName))}</p>
    <div style="margin:0 0 18px;padding:14px 16px;border:1px solid #C5E3FD;border-radius:16px;background:#F8FBFF;text-align:left;color:#374151;">
      ${details.map((line) => `<p style="margin:0 0 8px;">${line}</p>`).join("")}
    </div>
  `.trim();

  const textDetails = [
    `${l.listingLabel}: ${payload.listingTitle || "Runoot listing"}`,
    `${l.ownerLabel}: ${ownerName}`,
  ];

  return {
    subject: interpolateOwner(l.subject, ownerName),
    html: renderBaseEmailLayout({
      locale,
      title: l.title,
      bodyHtml,
      footerText: l.footer,
    }),
    text: [interpolateOwner(l.intro, ownerName), ...textDetails, l.footer].join("\n\n"),
  };
}
