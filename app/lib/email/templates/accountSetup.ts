import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { EmailLocale, RenderedEmailTemplate } from "../types";

const copy = {
  en: {
    title: "Your account is ready",
    intro: "Click the button below and complete your profile to join the community.",
    cta: "Set your password",
    fallback: "If the button does not work, copy and paste this link into your browser:",
    footer: "You are receiving this email because a Runoot admin created your account.",
  },
  it: {
    title: "Il tuo account e pronto",
    intro: "Clicca il pulsante qui sotto e completa il form per entrare nella community.",
    cta: "Imposta la password",
    fallback: "Se il pulsante non funziona, copia e incolla questo link nel browser:",
    footer: "Ricevi questa email perche un admin Runoot ha creato il tuo account.",
  },
  de: {
    title: "Ihr Konto ist bereit",
    intro: "Klicken Sie auf die Schaltflache unten und fullen Sie das Formular aus, um der Community beizutreten.",
    cta: "Passwort festlegen",
    fallback: "Wenn die Schaltflache nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:",
    footer: "Sie erhalten diese E-Mail, weil ein Runoot-Admin Ihr Konto erstellt hat.",
  },
  fr: {
    title: "Votre compte est pret",
    intro: "Cliquez sur le bouton ci-dessous et completez le formulaire pour rejoindre la communaute.",
    cta: "Definir le mot de passe",
    fallback: "Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :",
    footer: "Vous recevez cet e-mail car un admin Runoot a cree votre compte.",
  },
  es: {
    title: "Tu cuenta esta lista",
    intro: "Haz clic en el boton de abajo y completa el formulario para unirte a la comunidad.",
    cta: "Configurar contrasena",
    fallback: "Si el boton no funciona, copia y pega este enlace en tu navegador:",
    footer: "Recibes este correo porque un admin de Runoot ha creado tu cuenta.",
  },
  nl: {
    title: "Je account is klaar",
    intro: "Klik op de knop hieronder en vul het formulier in om je bij de community aan te sluiten.",
    cta: "Wachtwoord instellen",
    fallback: "Als de knop niet werkt, kopieer en plak deze link in je browser:",
    footer: "Je ontvangt deze e-mail omdat een Runoot-admin je account heeft aangemaakt.",
  },
  pt: {
    title: "Sua conta esta pronta",
    intro: "Clique no botao abaixo e preencha o formulario para entrar na comunidade.",
    cta: "Definir senha",
    fallback: "Se o botao nao funcionar, copie e cole este link no navegador:",
    footer: "Voce esta recebendo este e-mail porque um admin do Runoot criou sua conta.",
  },
} as const;

export interface AccountSetupPayload {
  setupLink: string;
}

export function renderAccountSetupTemplate(
  payload: AccountSetupPayload,
  locale: EmailLocale
): RenderedEmailTemplate {
  const t = copy[locale] || copy.en;

  const bodyHtml = `
    <p style="margin:0;color:#374151;">${escapeHtml(t.intro)}</p>
  `.trim();

  return {
    subject: t.title,
    html: renderBaseEmailLayout({
      locale,
      title: t.title,
      bodyHtml,
      ctaLabel: t.cta,
      ctaUrl: payload.setupLink,
      ctaCompact: true,
      ctaFallbackText: t.fallback,
      footerText: t.footer,
    }),
    text: `${t.title}\n\n${t.intro}\n\n${payload.setupLink}`,
  };
}
