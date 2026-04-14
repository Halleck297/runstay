import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { EmailLocale, RenderedEmailTemplate } from "../types";

const copy = {
  en: {
    subjectSuffix: "invited you to join runoot",
    defaultInviter: "Someone",
    title: "You have been invited to join Runoot.",
    intro: "invited you to join Runoot.",
    cta: "Accept invitation",
    fallback: "If the button does not work, click",
    description:
      "Runoot is a platform built for runners - a private space to connect and securely exchange race bibs, hotel bookings, and race packages when plans change.",
    joinLine:
      "Join the team to stay connected and manage your race opportunities within a trusted community.",
    welcomeMessageLabel: "{name} says:",
    footer:
      "You are receiving this email because someone invited you to join Runoot.",
  },
  it: {
    subjectSuffix: "ti ha invitato a entrare su runoot",
    defaultInviter: "Qualcuno",
    title: "Sei invitato su Runoot",
    intro: "ti ha invitato a entrare su Runoot.",
    cta: "Accetta invito",
    fallback: "Se il pulsante non funziona, fai clic",
    description:
      "Runoot e una piattaforma per runner: uno spazio privato per connettersi e scambiare in sicurezza pettorali, hotel e pacchetti gara quando i piani cambiano.",
    joinLine:
      "Unisciti al team per restare connesso e gestire le tue opportunita gara in una community affidabile.",
    welcomeMessageLabel: "{name} dice:",
    footer:
      "Ricevi questa email perche qualcuno ti ha invitato a entrare in Runoot.",
  },
  de: {
    subjectSuffix: "hat dich eingeladen, runoot beizutreten",
    defaultInviter: "Jemand",
    title: "Du bist zu Runoot eingeladen",
    intro: "hat dich eingeladen, Runoot beizutreten.",
    cta: "Einladung annehmen",
    fallback: "Wenn der Button nicht funktioniert, klicke",
    description:
      "Runoot ist eine Plattform fur Laufer - ein privater Bereich, um sich zu vernetzen und Startnummern, Hotelbuchungen und Laufpakete sicher zu tauschen, wenn sich Plane andern.",
    joinLine:
      "Tritt dem Team bei, um in Kontakt zu bleiben und deine Rennmoglichkeiten in einer vertrauenswurdigen Community zu verwalten.",
    welcomeMessageLabel: "{name} sagt:",
    footer:
      "Sie erhalten diese E-Mail, weil Sie zu Runoot eingeladen wurden.",
  },
  fr: {
    subjectSuffix: "vous a invite a rejoindre runoot",
    defaultInviter: "Quelqu'un",
    title: "Vous etes invite sur Runoot",
    intro: "vous a invite a rejoindre Runoot.",
    cta: "Accepter l'invitation",
    fallback: "Si le bouton ne fonctionne pas, cliquez",
    description:
      "Runoot est une plateforme pour les coureurs - un espace prive pour se connecter et echanger en toute securite des dossards, des reservations d'hotel et des packages course quand les plans changent.",
    joinLine:
      "Rejoignez l'equipe pour rester connecte et gerer vos opportunites de course dans une communaute de confiance.",
    welcomeMessageLabel: "{name} dit :",
    footer:
      "Vous recevez cet e-mail car quelqu'un vous a invite a rejoindre Runoot.",
  },
  es: {
    subjectSuffix: "te ha invitado a unirte a runoot",
    defaultInviter: "Alguien",
    title: "Estas invitado a Runoot",
    intro: "te ha invitado a unirte a Runoot.",
    cta: "Aceptar invitacion",
    fallback: "Si el boton no funciona, haz clic",
    description:
      "Runoot es una plataforma para corredores: un espacio privado para conectar y cambiar de forma segura dorsales, reservas de hotel y paquetes de carrera cuando cambian los planes.",
    joinLine:
      "Unete al equipo para mantenerte conectado y gestionar tus oportunidades de carrera en una comunidad de confianza.",
    welcomeMessageLabel: "{name} dice:",
    footer:
      "Recibes este correo porque alguien te ha invitado a unirte a Runoot.",
  },
  nl: {
    subjectSuffix: "heeft je uitgenodigd om je bij runoot aan te sluiten",
    defaultInviter: "Iemand",
    title: "Je bent uitgenodigd voor Runoot",
    intro: "heeft je uitgenodigd om je bij Runoot aan te sluiten.",
    cta: "Uitnodiging accepteren",
    fallback: "Als de knop niet werkt, klik",
    description:
      "Runoot is een platform voor hardlopers - een priveomgeving om veilig startnummers, hotelboekingen en racepakketten te ruilen wanneer plannen veranderen.",
    joinLine:
      "Word lid van het team om verbonden te blijven en je racekansen te beheren binnen een vertrouwde community.",
    welcomeMessageLabel: "{name} zegt:",
    footer:
      "Je ontvangt deze e-mail omdat iemand je heeft uitgenodigd voor Runoot.",
  },
  pt: {
    subjectSuffix: "convidou voce para entrar na runoot",
    defaultInviter: "Alguem",
    title: "Voce foi convidado para a Runoot",
    intro: "convidou voce para entrar na Runoot.",
    cta: "Aceitar convite",
    fallback: "Se o botao nao funcionar, clique",
    description:
      "Runoot e uma plataforma para corredores - um espaco privado para conectar e trocar com seguranca dorsais, reservas de hotel e pacotes de corrida quando os planos mudam.",
    joinLine:
      "Entre no time para continuar conectado e gerenciar suas oportunidades de corrida em uma comunidade confiavel.",
    welcomeMessageLabel: "{name} diz:",
    footer:
      "Voce esta recebendo este e-mail porque alguem convidou voce para entrar na Runoot.",
  },
} as const;

function sanitizeInviterName(value: string): string {
  return value
    .replace(/\bteam\s*leader\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

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
  const inviterNameRaw = sanitizeInviterName(payload.inviterName || "") || t.defaultInviter;
  const inviterName = escapeHtml(inviterNameRaw);
  const welcomeMessage = (payload.welcomeMessage || "").trim();
  const welcomeNameRaw = sanitizeInviterName(payload.inviterName || "") || t.defaultInviter;
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
    subject: `${inviterNameRaw} ${t.subjectSuffix}`,
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
