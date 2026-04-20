import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { EmailLocale, RenderedEmailTemplate } from "../types";

export interface AmbassadorInvitePayload {
  inviterName: string;
  referralLink: string;
}

const copy = {
  en: {
    subjectSuffix: "invited you to join Runoot",
    title: "You have been invited to join Runoot.",
    intro: "invited you to join Runoot.",
    cta: "Accept invitation",
    fallback: "If the button does not work, click",
    description:
      "Runoot is a platform built for runners - a private space to connect and securely exchange race bibs, hotel bookings, and race packages when plans change.",
    footer:
      "You are receiving this email because an Ambassador invited you to join Runoot.",
  },
  it: {
    subjectSuffix: "ti ha invitato su Runoot",
    title: "Sei stato invitato su Runoot.",
    intro: "ti ha invitato a entrare su Runoot.",
    cta: "Accetta invito",
    fallback: "Se il pulsante non funziona, fai clic",
    description:
      "Runoot è una piattaforma per runner: uno spazio privato per connettersi e scambiare in sicurezza pettorali, hotel e pacchetti gara quando i piani cambiano.",
    footer:
      "Ricevi questa email perché un Ambassador ti ha invitato a entrare in Runoot.",
  },
  de: {
    subjectSuffix: "hat dich zu Runoot eingeladen",
    title: "Du bist zu Runoot eingeladen.",
    intro: "hat dich eingeladen, Runoot beizutreten.",
    cta: "Einladung annehmen",
    fallback: "Wenn der Button nicht funktioniert, klicke",
    description:
      "Runoot ist eine Plattform für Läufer - ein privater Bereich, um sich zu vernetzen und Startnummern, Hotelbuchungen und Laufpakete sicher zu tauschen.",
    footer:
      "Sie erhalten diese E-Mail, weil ein Ambassador Sie zu Runoot eingeladen hat.",
  },
  fr: {
    subjectSuffix: "vous a invité à rejoindre Runoot",
    title: "Vous avez été invité sur Runoot.",
    intro: "vous a invité à rejoindre Runoot.",
    cta: "Accepter l'invitation",
    fallback: "Si le bouton ne fonctionne pas, cliquez",
    description:
      "Runoot est une plateforme pour les coureurs - un espace privé pour se connecter et échanger des dossards, réservations d'hôtel et packages course.",
    footer:
      "Vous recevez cet e-mail car un Ambassador vous a invité à rejoindre Runoot.",
  },
  es: {
    subjectSuffix: "te ha invitado a unirse a Runoot",
    title: "Has sido invitado a Runoot.",
    intro: "te ha invitado a unirte a Runoot.",
    cta: "Aceptar invitación",
    fallback: "Si el botón no funciona, haz clic",
    description:
      "Runoot es una plataforma para corredores: un espacio privado para conectar y cambiar dorsales, reservas de hotel y paquetes de carrera.",
    footer:
      "Recibes este correo porque un Ambassador te ha invitado a unirte a Runoot.",
  },
  nl: {
    subjectSuffix: "heeft je uitgenodigd voor Runoot",
    title: "Je bent uitgenodigd voor Runoot.",
    intro: "heeft je uitgenodigd voor Runoot.",
    cta: "Uitnodiging accepteren",
    fallback: "Als de knop niet werkt, klik dan",
    description:
      "Runoot is een platform voor hardlopers - een privéruimte om te verbinden en veilig startnummers, hotelboekingen en looppakketten te ruilen.",
    footer:
      "U ontvangt deze e-mail omdat een Ambassador u heeft uitgenodigd voor Runoot.",
  },
  pt: {
    subjectSuffix: "convidou-te para o Runoot",
    title: "Você foi convidado para o Runoot.",
    intro: "convidou-te para entrar no Runoot.",
    cta: "Aceitar convite",
    fallback: "Se o botão não funcionar, clique",
    description:
      "Runoot é uma plataforma para corredores - um espaço privado para se conectar e trocar com segurança dorsais, reservas de hotel e pacotes de corrida.",
    footer:
      "Você recebe este e-mail porque um Ambassador te convidou para o Runoot.",
  },
};

export function renderAmbassadorInviteTemplate(
  payload: AmbassadorInvitePayload,
  locale: EmailLocale
): RenderedEmailTemplate {
  const l = copy[locale] || copy.en;
  const safeName = escapeHtml(
    payload.inviterName.replace(/\s*ambassador\s*/gi, "").trim() || "Ambassador"
  );

  const subject = `${safeName} ${l.subjectSuffix}`;
  const intro = `<strong>${safeName}</strong> ${escapeHtml(l.intro)}`;
  const bodyHtml = `<p style="margin:0;color:#374151;">${escapeHtml(l.description)}</p>`;

  const html = renderBaseEmailLayout({
    locale,
    title: l.title,
    intro,
    bodyHtml,
    ctaLabel: l.cta,
    ctaUrl: payload.referralLink,
    ctaFallbackText: l.fallback,
    footerText: l.footer,
  });

  const text = `${safeName} ${l.intro}\n\n${l.description}\n\n${l.cta}: ${payload.referralLink}\n\n${l.footer}`;

  return { subject, html, text };
}
