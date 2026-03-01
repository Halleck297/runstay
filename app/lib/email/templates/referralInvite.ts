import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { EmailLocale, RenderedEmailTemplate } from "../types";

const copy = {
  en: {
    subject: "Runoot invitation",
    defaultInviter: "A Team Leader",
    title: "You have been invited to join Runoot.",
    intro: "invited you to become part of their team.",
    cta: "Accept invitation",
    fallback: "If the button does not work, copy and paste this link into your browser:",
    description:
      "Runoot is a platform built for runners - a private space to connect and securely exchange race bibs, hotel bookings, and race packages when plans change.",
    joinLine:
      "Join the team to stay connected and manage your race opportunities within a trusted community.",
    welcomeMessageLabel: "{name} says:",
    footer:
      "You are receiving this email because someone invited you to join Runoot.",
  },
  it: {
    subject: "Invito Runoot",
    defaultInviter: "Un Team Leader",
    title: "Sei invitato su Runoot",
    intro: "ti ha invitato nella sua community di corsa.",
    cta: "Accetta invito",
    fallback: "Se il pulsante non funziona, apri questo link:",
    description:
      "Runoot e una piattaforma per runner: uno spazio privato per connettersi e scambiare in sicurezza pettorali, hotel e pacchetti gara quando i piani cambiano.",
    joinLine:
      "Unisciti al team per restare connesso e gestire le tue opportunita gara in una community affidabile.",
    welcomeMessageLabel: "{name} dice:",
    footer:
      "Ricevi questa email perche qualcuno ti ha invitato a entrare in Runoot.",
  },
  de: {
    subject: "Runoot-Einladung",
    defaultInviter: "Ein Team Leader",
    title: "Du bist zu Runoot eingeladen",
    intro: "hat dich in die Lauf-Community eingeladen.",
    cta: "Einladung annehmen",
    fallback: "Wenn der Button nicht funktioniert, oeffne diesen Link:",
    description:
      "Runoot ist eine Plattform fur Laufer - ein privater Bereich, um sich zu vernetzen und Startnummern, Hotelbuchungen und Laufpakete sicher zu tauschen, wenn sich Plane andern.",
    joinLine:
      "Tritt dem Team bei, um in Kontakt zu bleiben und deine Rennmoglichkeiten in einer vertrauenswurdigen Community zu verwalten.",
    welcomeMessageLabel: "{name} sagt:",
    footer:
      "Sie erhalten diese E-Mail, weil Sie zu Runoot eingeladen wurden.",
  },
  fr: {
    subject: "Invitation Runoot",
    defaultInviter: "Un Team Leader",
    title: "Vous etes invite sur Runoot",
    intro: "vous a invite dans la communaute running.",
    cta: "Accepter l'invitation",
    fallback: "Si le bouton ne fonctionne pas, ouvrez ce lien :",
    description:
      "Runoot est une plateforme pour les coureurs - un espace prive pour se connecter et echanger en toute securite des dossards, des reservations d'hotel et des packages course quand les plans changent.",
    joinLine:
      "Rejoignez l'equipe pour rester connecte et gerer vos opportunites de course dans une communaute de confiance.",
    welcomeMessageLabel: "{name} dit :",
    footer:
      "Vous recevez cet e-mail car quelqu'un vous a invite a rejoindre Runoot.",
  },
  es: {
    subject: "Invitacion a Runoot",
    defaultInviter: "Un Team Leader",
    title: "Estas invitado a Runoot",
    intro: "te ha invitado a su comunidad de running.",
    cta: "Aceptar invitacion",
    fallback: "Si el boton no funciona, abre este enlace:",
    description:
      "Runoot es una plataforma para corredores: un espacio privado para conectar y cambiar de forma segura dorsales, reservas de hotel y paquetes de carrera cuando cambian los planes.",
    joinLine:
      "Unete al equipo para mantenerte conectado y gestionar tus oportunidades de carrera en una comunidad de confianza.",
    welcomeMessageLabel: "{name} dice:",
    footer:
      "Recibes este correo porque alguien te ha invitado a unirte a Runoot.",
  },
  nl: {
    subject: "Runoot-uitnodiging",
    defaultInviter: "Een Team Leader",
    title: "Je bent uitgenodigd voor Runoot",
    intro: "heeft je uitgenodigd om deel uit te maken van het team.",
    cta: "Uitnodiging accepteren",
    fallback: "Als de knop niet werkt, open dan deze link:",
    description:
      "Runoot is een platform voor hardlopers - een priveomgeving om veilig startnummers, hotelboekingen en racepakketten te ruilen wanneer plannen veranderen.",
    joinLine:
      "Word lid van het team om verbonden te blijven en je racekansen te beheren binnen een vertrouwde community.",
    welcomeMessageLabel: "{name} zegt:",
    footer:
      "Je ontvangt deze e-mail omdat iemand je heeft uitgenodigd voor Runoot.",
  },
  pt: {
    subject: "Convite Runoot",
    defaultInviter: "Um Team Leader",
    title: "Voce foi convidado para a Runoot",
    intro: "convidou voce para fazer parte do time.",
    cta: "Aceitar convite",
    fallback: "Se o botao nao funcionar, abra este link:",
    description:
      "Runoot e uma plataforma para corredores - um espaco privado para conectar e trocar com seguranca dorsais, reservas de hotel e pacotes de corrida quando os planos mudam.",
    joinLine:
      "Entre no time para continuar conectado e gerenciar suas oportunidades de corrida em uma comunidade confiavel.",
    welcomeMessageLabel: "{name} diz:",
    footer:
      "Voce esta recebendo este e-mail porque alguem convidou voce para entrar na Runoot.",
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
  const description = t.description;
  const joinLine = t.joinLine;
  const inviterNameRaw = payload.inviterName || t.defaultInviter;
  const inviterName = escapeHtml(inviterNameRaw);
  const welcomeMessage = (payload.welcomeMessage || "").trim();
  const welcomeNameRaw = (payload.inviterName || "")
    .replace(/\bteam leader\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || "Someone";
  const welcomeMessageLabel = t.welcomeMessageLabel.includes("{name}")
    ? t.welcomeMessageLabel.replace("{name}", welcomeNameRaw)
    : `${t.welcomeMessageLabel} ${welcomeNameRaw}`;
  const welcomeBlock = welcomeMessage
    ? `<div style="margin:14px 0;padding:14px;border-radius:24px;background:#ECF4FE;border:1px solid #d6e6fb;">
         <p style="margin:0 0 8px;color:#6b7280;font-size:12px;font-weight:600;">${escapeHtml(welcomeMessageLabel)}</p>
         <p style="margin:0;color:#111827;">${escapeHtml(welcomeMessage)}</p>
       </div>`
    : "";
  const bodyHtml = `
    <p style="margin:0 0 10px;color:#374151;">${escapeHtml(description)}</p>
    <p style="margin:0 0 10px;color:#374151;">${escapeHtml(joinLine)}</p>
    ${welcomeBlock}
  `.trim();

  return {
    subject: t.subject,
    html: renderBaseEmailLayout({
      locale,
      title: t.title,
      intro: `${inviterName} ${escapeHtml(t.intro)}`,
      bodyHtml,
      ctaLabel: t.cta,
      ctaUrl: payload.referralLink,
      ctaFallbackText: t.fallback,
      footerText: t.footer,
    }),
    text: [
      t.title,
      `${inviterNameRaw} ${t.intro}`,
      description,
      joinLine,
      welcomeMessage ? `${welcomeMessageLabel} ${welcomeMessage}` : null,
      `${t.fallback} ${payload.referralLink}`,
    ].filter(Boolean).join("\n\n"),
  };
}
