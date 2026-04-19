import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { EmailLocale, RenderedEmailTemplate } from "../types";

const copy = {
  en: {
    subject: "Welcome to Runoot!",
    title: "Welcome to Runoot!",
    intro1: "Congratulations! You have joined the most exclusive and authentic community for runners.",
    intro2: "Runoot is the go-to platform made by runners, for runners — where you can exchange bibs and hotel rooms when plans change. No more lost money, wasted bibs or empty rooms.",
    profileTitle: "Complete your profile",
    body1: "Everyone on this platform is a real, verified runner — but we'd love to know you better!",
    body2: "By filling in your information you'll help grow the credibility of the community.",
    cta: "Complete my profile →",
    footer: "You are receiving this email because you just joined Runoot.",
  },
  it: {
    subject: "Benvenuto su Runoot!",
    title: "Benvenuto su Runoot!",
    intro1: "Complimenti! Sei entrato a far parte della community più esclusiva e autentica per i runners.",
    intro2: "Runoot è la piattaforma di riferimento fatta da runners, per i runners — dove scambiare pettorali e hotel quando i piani cambiano. Niente più soldi persi, pettorali sprecati e camere vuote.",
    profileTitle: "Completa il tuo profilo",
    body1: "Gli utenti di questa piattaforma sono tutti runners reali e verificati, ma vogliamo conoscerti meglio!",
    body2: "Inserendo le tue informazioni aiuterai a far crescere la credibilità della community.",
    cta: "Completa il profilo →",
    footer: "Ricevi questa email perché ti sei appena iscritto a Runoot.",
  },
  de: {
    subject: "Willkommen bei Runoot!",
    title: "Willkommen bei Runoot!",
    intro1: "Herzlichen Glückwunsch! Du bist jetzt Teil der exklusivsten und authentischsten Community für Läufer.",
    intro2: "Runoot ist die führende Plattform von Läufern, für Läufer — zum Tauschen von Startnummern und Hotelzimmern, wenn Pläne sich ändern. Kein Geldverlust mehr, keine verschwendeten Startnummern und keine leeren Zimmer.",
    profileTitle: "Vervollständige dein Profil",
    body1: "Alle auf dieser Plattform sind echte, verifizierte Läufer — aber wir möchten dich besser kennenlernen!",
    body2: "Mit deinen Informationen hilfst du dabei, die Glaubwürdigkeit der Community zu stärken.",
    cta: "Profil vervollständigen →",
    footer: "Du erhältst diese E-Mail, weil du dich gerade bei Runoot registriert hast.",
  },
  fr: {
    subject: "Bienvenue sur Runoot !",
    title: "Bienvenue sur Runoot !",
    intro1: "Félicitations ! Tu fais maintenant partie de la communauté la plus exclusive et authentique pour les coureurs.",
    intro2: "Runoot est la plateforme de référence faite par des coureurs, pour des coureurs — pour échanger des dossards et des chambres d'hôtel quand les plans changent. Fini l'argent perdu, les dossards gaspillés et les chambres vides.",
    profileTitle: "Complète ton profil",
    body1: "Tous les utilisateurs de cette plateforme sont de vrais coureurs vérifiés — mais nous voulons mieux te connaître !",
    body2: "En renseignant tes informations, tu contribueras à renforcer la crédibilité de la communauté.",
    cta: "Compléter mon profil →",
    footer: "Tu reçois cet e-mail car tu viens de t'inscrire sur Runoot.",
  },
  es: {
    subject: "¡Bienvenido a Runoot!",
    title: "¡Bienvenido a Runoot!",
    intro1: "¡Felicidades! Ya eres parte de la comunidad más exclusiva y auténtica para corredores.",
    intro2: "Runoot es la plataforma de referencia hecha por corredores, para corredores — donde intercambiar dorsales y habitaciones de hotel cuando los planes cambian. Nada más de dinero perdido, dorsales desperdiciados y habitaciones vacías.",
    profileTitle: "Completa tu perfil",
    body1: "Todos los usuarios de esta plataforma son corredores reales y verificados, ¡pero queremos conocerte mejor!",
    body2: "Al añadir tu información ayudarás a hacer crecer la credibilidad de la comunidad.",
    cta: "Completar mi perfil →",
    footer: "Recibes este correo porque acabas de unirte a Runoot.",
  },
  nl: {
    subject: "Welkom bij Runoot!",
    title: "Welkom bij Runoot!",
    intro1: "Gefeliciteerd! Je maakt nu deel uit van de meest exclusieve en authentieke community voor hardlopers.",
    intro2: "Runoot is het toonaangevende platform gemaakt door hardlopers, voor hardlopers — om startnummers en hotelkamers te ruilen als plannen veranderen. Geen verloren geld meer, verspilde startnummers of lege kamers.",
    profileTitle: "Vul je profiel in",
    body1: "Alle gebruikers op dit platform zijn echte, geverifieerde hardlopers — maar we willen je graag beter leren kennen!",
    body2: "Door je informatie in te vullen help je de geloofwaardigheid van de community te vergroten.",
    cta: "Profiel invullen →",
    footer: "Je ontvangt deze e-mail omdat je je zojuist hebt aangemeld bij Runoot.",
  },
  pt: {
    subject: "Bem-vindo ao Runoot!",
    title: "Bem-vindo ao Runoot!",
    intro1: "Parabéns! Você acaba de entrar na community mais exclusiva e autêntica para corredores.",
    intro2: "Runoot é a plataforma de referência feita por corredores, para corredores — onde trocar dorsais e quartos de hotel quando os planos mudam. Chega de dinheiro perdido, dorsais desperdiçados e quartos vazios.",
    profileTitle: "Complete o seu perfil",
    body1: "Todos os utilizadores desta plataforma são corredores reais e verificados, mas queremos conhecê-lo melhor!",
    body2: "Ao preencher as suas informações, ajudará a aumentar a credibilidade da comunidade.",
    cta: "Completar perfil →",
    footer: "Você está recebendo este e-mail porque acabou de se registrar no Runoot.",
  },
} as const;

const greetingByLocale: Record<EmailLocale, string> = {
  en: "Hi",
  it: "Ciao",
  de: "Hallo",
  fr: "Bonjour",
  es: "Hola",
  nl: "Hoi",
  pt: "Olá",
};

export interface WelcomeUserPayload {
  firstName: string;
  profileUrl: string;
}

export function renderWelcomeUserTemplate(
  payload: WelcomeUserPayload,
  locale: EmailLocale
): RenderedEmailTemplate {
  const t = copy[locale] ?? copy.en;

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#374151;font-size:16px;">${escapeHtml(greetingByLocale[locale] ?? greetingByLocale.en)} ${escapeHtml(payload.firstName)}!</p>
    <p style="margin:0 0 8px;color:#374151;">${escapeHtml(t.intro1)}</p>
    <p style="margin:0 0 24px;color:#374151;">${escapeHtml(t.intro2)}</p>
    <p style="margin:0 0 8px;font-weight:600;color:#111827;">${escapeHtml(t.profileTitle)}</p>
    <p style="margin:0 0 8px;color:#374151;">${escapeHtml(t.body1)}</p>
    <p style="margin:0;color:#374151;">${escapeHtml(t.body2)}</p>
  `.trim();

  return {
    subject: t.subject,
    html: renderBaseEmailLayout({
      locale,
      title: t.title,
      bodyHtml,
      ctaLabel: t.cta,
      ctaUrl: payload.profileUrl,
      ctaFallbackText: locale === "it" ? "Clicca qui" : locale === "de" ? "Hier klicken" : locale === "fr" ? "Cliquez ici" : locale === "es" ? "Haz clic aquí" : locale === "nl" ? "Klik hier" : locale === "pt" ? "Clique aqui" : "Click here",
      footerText: t.footer,
    }),
    text: `${t.title}\n\n${t.intro1}\n\n${t.intro2}\n\n${t.profileTitle}\n${t.body1}\n${t.body2}\n\n${payload.profileUrl}`,
  };
}
