import type { SupportedLocale } from "~/lib/locale";

export type LegalPolicyType = "terms" | "privacy" | "cookies";

export type LegalPolicySection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalPolicyDocument = {
  title: string;
  metaTitle: string;
  metaDescription: string;
  updatedAt: string;
  summary: string;
  sections: LegalPolicySection[];
};

const TERMS: Record<SupportedLocale, LegalPolicyDocument> = {
  en: {
    title: "Terms of Service",
    metaTitle: "Terms of Service | Runoot",
    metaDescription: "Terms of Service for using the Runoot platform.",
    updatedAt: "March 2, 2026",
    summary: "These Terms govern access to and use of Runoot.",
    sections: [
      { title: "1. Scope", paragraphs: ["These Terms apply to all users of runoot.com and related services.", "By using the platform you accept these Terms, the Privacy Policy, and the Cookie Policy."] },
      { title: "2. Platform Role", paragraphs: ["Runoot is a listing platform connecting users interested in hotel rooms, bibs, and packages.", "Runoot is not a party to agreements between users and does not process payments between users."] },
      { title: "3. User Obligations", paragraphs: ["Users must provide accurate information and comply with applicable laws and event rules."], bullets: ["Do not publish unlawful or misleading listings.", "Do not impersonate other people or entities.", "Do not use the platform for fraud or abuse."] },
      { title: "4. Liability", paragraphs: ["Transactions happen directly between users at their own risk.", "Runoot does not guarantee listing accuracy, availability, or transaction outcomes."] },
      { title: "5. Suspension and Termination", paragraphs: ["Runoot may suspend or close accounts that violate these Terms or applicable laws."] },
      { title: "6. Governing Law", paragraphs: ["These Terms are governed by applicable law indicated in Runoot legal notices, unless mandatory consumer protections apply."] },
      { title: "7. Contact", paragraphs: ["For legal questions, contact legal@runoot.com."] },
    ],
  },
  it: {
    title: "Termini di Servizio",
    metaTitle: "Termini di Servizio | Runoot",
    metaDescription: "Termini di Servizio per l'utilizzo della piattaforma Runoot.",
    updatedAt: "2 marzo 2026",
    summary: "I presenti Termini regolano l'accesso e l'uso di Runoot.",
    sections: [
      { title: "1. Ambito", paragraphs: ["I presenti Termini si applicano a tutti gli utenti di runoot.com e dei servizi collegati.", "Usando la piattaforma accetti Termini, Privacy Policy e Cookie Policy."] },
      { title: "2. Ruolo della piattaforma", paragraphs: ["Runoot e una piattaforma di annunci che mette in contatto utenti interessati a camere hotel, bib e pacchetti.", "Runoot non e parte dei contratti tra utenti e non gestisce pagamenti tra utenti."] },
      { title: "3. Obblighi utente", paragraphs: ["Gli utenti devono fornire dati corretti e rispettare leggi applicabili e regolamenti degli eventi."], bullets: ["Non pubblicare annunci illeciti o ingannevoli.", "Non impersonare persone o societa.", "Non usare la piattaforma per frodi o abusi."] },
      { title: "4. Responsabilita", paragraphs: ["Le transazioni avvengono direttamente tra utenti a loro esclusivo rischio.", "Runoot non garantisce accuratezza annunci, disponibilita o esito delle transazioni."] },
      { title: "5. Sospensione e chiusura account", paragraphs: ["Runoot puo sospendere o chiudere account che violano Termini o norme applicabili."] },
      { title: "6. Legge applicabile", paragraphs: ["I Termini sono regolati dalla legge applicabile indicata nelle note legali Runoot, salvo tutele inderogabili per il consumatore."] },
      { title: "7. Contatti", paragraphs: ["Per questioni legali: legal@runoot.com."] },
    ],
  },
  es: {
    title: "Terminos del Servicio",
    metaTitle: "Terminos del Servicio | Runoot",
    metaDescription: "Terminos del Servicio para usar la plataforma Runoot.",
    updatedAt: "2 de marzo de 2026",
    summary: "Estos Terminos regulan el acceso y uso de Runoot.",
    sections: [
      { title: "1. Alcance", paragraphs: ["Estos Terminos se aplican a todos los usuarios de runoot.com y servicios relacionados.", "Al usar la plataforma aceptas estos Terminos, la Politica de Privacidad y la Politica de Cookies."] },
      { title: "2. Rol de la plataforma", paragraphs: ["Runoot es una plataforma de anuncios que conecta usuarios interesados en habitaciones, dorsales y paquetes.", "Runoot no es parte de los acuerdos entre usuarios ni procesa pagos entre usuarios."] },
      { title: "3. Obligaciones del usuario", paragraphs: ["Los usuarios deben proporcionar informacion correcta y cumplir la ley aplicable y reglas de eventos."], bullets: ["No publicar anuncios ilegales o enganosos.", "No suplantar a otras personas o entidades.", "No usar la plataforma para fraude o abuso."] },
      { title: "4. Responsabilidad", paragraphs: ["Las transacciones se realizan directamente entre usuarios bajo su propio riesgo.", "Runoot no garantiza exactitud de anuncios, disponibilidad ni resultados de transacciones."] },
      { title: "5. Suspension y cierre", paragraphs: ["Runoot puede suspender o cerrar cuentas que incumplan estos Terminos o la ley aplicable."] },
      { title: "6. Ley aplicable", paragraphs: ["Estos Terminos se rigen por la ley aplicable indicada en los avisos legales de Runoot, salvo protecciones obligatorias al consumidor."] },
      { title: "7. Contacto", paragraphs: ["Para temas legales: legal@runoot.com."] },
    ],
  },
  fr: {
    title: "Conditions d'utilisation",
    metaTitle: "Conditions d'utilisation | Runoot",
    metaDescription: "Conditions d'utilisation de la plateforme Runoot.",
    updatedAt: "2 mars 2026",
    summary: "Ces conditions regissent l'acces et l'utilisation de Runoot.",
    sections: [
      { title: "1. Portee", paragraphs: ["Ces conditions s'appliquent a tous les utilisateurs de runoot.com et des services associes.", "En utilisant la plateforme, vous acceptez ces conditions, la politique de confidentialite et la politique de cookies."] },
      { title: "2. Role de la plateforme", paragraphs: ["Runoot est une plateforme d'annonces reliant des utilisateurs interesses par chambres, dossards et packages.", "Runoot n'est pas partie aux accords entre utilisateurs et ne traite pas les paiements entre utilisateurs."] },
      { title: "3. Obligations utilisateur", paragraphs: ["Les utilisateurs doivent fournir des informations exactes et respecter la loi applicable et les regles des evenements."], bullets: ["Ne pas publier d'annonces illegales ou trompeuses.", "Ne pas usurper l'identite d'autrui.", "Ne pas utiliser la plateforme pour fraude ou abus."] },
      { title: "4. Responsabilite", paragraphs: ["Les transactions ont lieu directement entre utilisateurs a leurs propres risques.", "Runoot ne garantit pas l'exactitude des annonces, la disponibilite ou l'issue des transactions."] },
      { title: "5. Suspension et fermeture", paragraphs: ["Runoot peut suspendre ou fermer des comptes en cas de violation de ces conditions ou de la loi applicable."] },
      { title: "6. Droit applicable", paragraphs: ["Ces conditions sont regies par la loi applicable indiquee dans les mentions legales Runoot, sous reserve des protections obligatoires du consommateur."] },
      { title: "7. Contact", paragraphs: ["Pour les questions juridiques: legal@runoot.com."] },
    ],
  },
  de: {
    title: "Nutzungsbedingungen",
    metaTitle: "Nutzungsbedingungen | Runoot",
    metaDescription: "Nutzungsbedingungen fur die Runoot Plattform.",
    updatedAt: "2. Marz 2026",
    summary: "Diese Bedingungen regeln den Zugang zu Runoot und dessen Nutzung.",
    sections: [
      { title: "1. Geltungsbereich", paragraphs: ["Diese Bedingungen gelten fur alle Nutzer von runoot.com und zugehorigen Diensten.", "Mit der Nutzung akzeptieren Sie diese Bedingungen, die Datenschutzerklarung und die Cookie-Richtlinie."] },
      { title: "2. Rolle der Plattform", paragraphs: ["Runoot ist eine Anzeigenplattform fur Zimmer, Startnummern und Pakete.", "Runoot ist keine Vertragspartei zwischen Nutzern und verarbeitet keine Zahlungen zwischen Nutzern."] },
      { title: "3. Pflichten der Nutzer", paragraphs: ["Nutzer mussen richtige Angaben machen und geltende Gesetze sowie Veranstaltungsregeln einhalten."], bullets: ["Keine rechtswidrigen oder irrefuhrenden Anzeigen veroffentlichen.", "Keine Identitatstauschung.", "Keine Nutzung fur Betrug oder Missbrauch."] },
      { title: "4. Haftung", paragraphs: ["Transaktionen erfolgen direkt zwischen Nutzern auf eigenes Risiko.", "Runoot garantiert keine Richtigkeit von Anzeigen, Verfugbarkeit oder Transaktionsergebnisse."] },
      { title: "5. Sperrung und Beendigung", paragraphs: ["Runoot kann Konten bei VerstoB gegen diese Bedingungen oder geltendes Recht sperren oder schlieBen."] },
      { title: "6. Anwendbares Recht", paragraphs: ["Es gilt das in den rechtlichen Hinweisen von Runoot angegebene anwendbare Recht, vorbehaltlich zwingender Verbraucherschutzvorschriften."] },
      { title: "7. Kontakt", paragraphs: ["Fur rechtliche Fragen: legal@runoot.com."] },
    ],
  },
  nl: {
    title: "Gebruiksvoorwaarden",
    metaTitle: "Gebruiksvoorwaarden | Runoot",
    metaDescription: "Gebruiksvoorwaarden voor het gebruik van Runoot.",
    updatedAt: "2 maart 2026",
    summary: "Deze voorwaarden regelen toegang tot en gebruik van Runoot.",
    sections: [
      { title: "1. Toepassing", paragraphs: ["Deze voorwaarden gelden voor alle gebruikers van runoot.com en verwante diensten.", "Door het platform te gebruiken accepteer je deze voorwaarden, het privacybeleid en het cookiebeleid."] },
      { title: "2. Rol van het platform", paragraphs: ["Runoot is een advertentieplatform voor kamers, startnummers en pakketten.", "Runoot is geen partij bij overeenkomsten tussen gebruikers en verwerkt geen betalingen tussen gebruikers."] },
      { title: "3. Verplichtingen van gebruikers", paragraphs: ["Gebruikers moeten correcte informatie geven en toepasselijke wetgeving en evenementregels naleven."], bullets: ["Geen illegale of misleidende advertenties plaatsen.", "Niet doen alsof je iemand anders bent.", "Geen fraude of misbruik via het platform."] },
      { title: "4. Aansprakelijkheid", paragraphs: ["Transacties vinden direct tussen gebruikers plaats op eigen risico.", "Runoot garandeert geen juistheid van advertenties, beschikbaarheid of uitkomst van transacties."] },
      { title: "5. Opschorting en beeindiging", paragraphs: ["Runoot kan accounts opschorten of sluiten bij overtreding van deze voorwaarden of toepasselijke wetgeving."] },
      { title: "6. Toepasselijk recht", paragraphs: ["Op deze voorwaarden is het toepasselijke recht van de Runoot juridische kennisgeving van toepassing, met inachtneming van dwingende consumentenbescherming."] },
      { title: "7. Contact", paragraphs: ["Voor juridische vragen: legal@runoot.com."] },
    ],
  },
  pt: {
    title: "Termos de Servico",
    metaTitle: "Termos de Servico | Runoot",
    metaDescription: "Termos de Servico para usar a plataforma Runoot.",
    updatedAt: "2 de marco de 2026",
    summary: "Estes termos regulam o acesso e uso da Runoot.",
    sections: [
      { title: "1. Escopo", paragraphs: ["Estes termos aplicam-se a todos os usuarios de runoot.com e servicos relacionados.", "Ao usar a plataforma, voce aceita estes termos, a Politica de Privacidade e a Politica de Cookies."] },
      { title: "2. Papel da plataforma", paragraphs: ["A Runoot e uma plataforma de anuncios para quartos, dorsais e pacotes.", "A Runoot nao e parte dos acordos entre usuarios e nao processa pagamentos entre usuarios."] },
      { title: "3. Obrigacoes do usuario", paragraphs: ["Usuarios devem fornecer informacoes corretas e cumprir as leis aplicaveis e regras dos eventos."], bullets: ["Nao publicar anuncios ilegais ou enganosos.", "Nao se passar por outra pessoa ou entidade.", "Nao usar a plataforma para fraude ou abuso."] },
      { title: "4. Responsabilidade", paragraphs: ["As transacoes ocorrem diretamente entre usuarios por conta e risco proprios.", "A Runoot nao garante exatidao de anuncios, disponibilidade ou resultado das transacoes."] },
      { title: "5. Suspensao e encerramento", paragraphs: ["A Runoot pode suspender ou encerrar contas que violem estes termos ou a legislacao aplicavel."] },
      { title: "6. Lei aplicavel", paragraphs: ["Estes termos sao regidos pela lei aplicavel indicada nas notas legais da Runoot, sem prejuizo de protecoes obrigatorias ao consumidor."] },
      { title: "7. Contato", paragraphs: ["Para questoes legais: legal@runoot.com."] },
    ],
  },
};

const PRIVACY: Record<SupportedLocale, LegalPolicyDocument> = {
  en: {
    title: "Privacy Policy",
    metaTitle: "Privacy Policy | Runoot",
    metaDescription: "How Runoot collects, uses, and protects personal data.",
    updatedAt: "March 2, 2026",
    summary: "This Policy explains how personal data is handled on Runoot.",
    sections: [
      { title: "1. Data Controller", paragraphs: ["Data controller details are provided in Runoot legal notices.", "For privacy matters: privacy@runoot.com."] },
      { title: "2. Data We Collect", paragraphs: ["We may process account data, profile data, listing data, message data, and technical data such as IP and device info."], bullets: ["Registration and login data", "Profile and listing content", "Support and contact communications", "Security and usage logs"] },
      { title: "3. Purposes and Legal Bases", paragraphs: ["We process data to provide the service, secure the platform, communicate with users, and comply with legal obligations.", "Where required, consent is requested for optional processing."] },
      { title: "4. Sharing", paragraphs: ["Data can be shared with service providers that support hosting, authentication, email, and security.", "Data may be disclosed where required by law or to protect rights and safety."] },
      { title: "5. Retention and Rights", paragraphs: ["We retain data only for as long as needed for service and legal purposes.", "Users may request access, correction, deletion, portability, or restriction where applicable."] },
      { title: "6. Contact", paragraphs: ["Privacy requests: privacy@runoot.com."] },
    ],
  },
  it: {
    title: "Privacy Policy",
    metaTitle: "Privacy Policy | Runoot",
    metaDescription: "Come Runoot raccoglie, usa e protegge i dati personali.",
    updatedAt: "2 marzo 2026",
    summary: "Questa Policy spiega il trattamento dei dati personali su Runoot.",
    sections: [
      { title: "1. Titolare del trattamento", paragraphs: ["I dati del titolare sono indicati nelle note legali Runoot.", "Per richieste privacy: privacy@runoot.com."] },
      { title: "2. Dati raccolti", paragraphs: ["Possiamo trattare dati account, dati profilo, dati annunci, dati messaggi e dati tecnici come IP e dispositivo."], bullets: ["Dati di registrazione e login", "Contenuti profilo e annunci", "Comunicazioni supporto e contatto", "Log di sicurezza e utilizzo"] },
      { title: "3. Finalita e basi giuridiche", paragraphs: ["Trattiamo i dati per erogare il servizio, proteggere la piattaforma, comunicare con gli utenti e rispettare obblighi di legge.", "Quando richiesto, viene raccolto il consenso per trattamenti opzionali."] },
      { title: "4. Condivisione", paragraphs: ["I dati possono essere condivisi con fornitori che supportano hosting, autenticazione, email e sicurezza.", "I dati possono essere comunicati se richiesto dalla legge o per tutela di diritti e sicurezza."] },
      { title: "5. Conservazione e diritti", paragraphs: ["Conserviamo i dati solo per il tempo necessario a finalita di servizio e obblighi legali.", "Gli utenti possono chiedere accesso, rettifica, cancellazione, portabilita o limitazione quando applicabile."] },
      { title: "6. Contatti", paragraphs: ["Richieste privacy: privacy@runoot.com."] },
    ],
  },
  es: {
    title: "Politica de Privacidad",
    metaTitle: "Politica de Privacidad | Runoot",
    metaDescription: "Como Runoot recopila, usa y protege los datos personales.",
    updatedAt: "2 de marzo de 2026",
    summary: "Esta Politica explica el tratamiento de datos personales en Runoot.",
    sections: [
      { title: "1. Responsable del tratamiento", paragraphs: ["Los datos del responsable figuran en los avisos legales de Runoot.", "Para privacidad: privacy@runoot.com."] },
      { title: "2. Datos que recopilamos", paragraphs: ["Podemos tratar datos de cuenta, perfil, anuncios, mensajes y datos tecnicos como IP y dispositivo."], bullets: ["Datos de registro e inicio de sesion", "Contenido de perfil y anuncios", "Comunicaciones de soporte y contacto", "Registros de seguridad y uso"] },
      { title: "3. Finalidades y bases legales", paragraphs: ["Tratamos datos para prestar el servicio, proteger la plataforma, comunicarnos con usuarios y cumplir obligaciones legales.", "Cuando sea necesario, pedimos consentimiento para tratamientos opcionales."] },
      { title: "4. Comparticion", paragraphs: ["Los datos pueden compartirse con proveedores de hosting, autenticacion, correo y seguridad.", "Tambien pueden revelarse cuando lo exija la ley o para proteger derechos y seguridad."] },
      { title: "5. Conservacion y derechos", paragraphs: ["Conservamos los datos solo el tiempo necesario para fines de servicio y obligaciones legales.", "Los usuarios pueden solicitar acceso, rectificacion, supresion, portabilidad o limitacion cuando corresponda."] },
      { title: "6. Contacto", paragraphs: ["Solicitudes de privacidad: privacy@runoot.com."] },
    ],
  },
  fr: {
    title: "Politique de confidentialite",
    metaTitle: "Politique de confidentialite | Runoot",
    metaDescription: "Comment Runoot collecte, utilise et protege les donnees personnelles.",
    updatedAt: "2 mars 2026",
    summary: "Cette politique explique le traitement des donnees personnelles sur Runoot.",
    sections: [
      { title: "1. Responsable du traitement", paragraphs: ["Les informations du responsable figurent dans les mentions legales de Runoot.", "Pour la confidentialite: privacy@runoot.com."] },
      { title: "2. Donnees collectees", paragraphs: ["Nous pouvons traiter les donnees de compte, profil, annonces, messages et donnees techniques comme IP et appareil."], bullets: ["Donnees d'inscription et connexion", "Contenus de profil et annonces", "Communications support et contact", "Journaux de securite et d'usage"] },
      { title: "3. Finalites et bases legales", paragraphs: ["Nous traitons les donnees pour fournir le service, securiser la plateforme, communiquer avec les utilisateurs et respecter la loi.", "Le consentement est demande pour les traitements optionnels lorsque requis."] },
      { title: "4. Partage", paragraphs: ["Les donnees peuvent etre partagees avec des prestataires pour hebergement, authentification, email et securite.", "Elles peuvent aussi etre divulguees si la loi l'exige ou pour proteger droits et securite."] },
      { title: "5. Conservation et droits", paragraphs: ["Nous conservons les donnees uniquement pendant la duree necessaire aux finalites de service et obligations legales.", "Les utilisateurs peuvent demander acces, rectification, suppression, portabilite ou limitation selon les cas."] },
      { title: "6. Contact", paragraphs: ["Demandes de confidentialite: privacy@runoot.com."] },
    ],
  },
  de: {
    title: "Datenschutzrichtlinie",
    metaTitle: "Datenschutzrichtlinie | Runoot",
    metaDescription: "Wie Runoot personenbezogene Daten erhebt, nutzt und schutzt.",
    updatedAt: "2. Marz 2026",
    summary: "Diese Richtlinie erklart die Verarbeitung personenbezogener Daten bei Runoot.",
    sections: [
      { title: "1. Verantwortlicher", paragraphs: ["Angaben zum Verantwortlichen stehen in den rechtlichen Hinweisen von Runoot.", "Fur Datenschutzanfragen: privacy@runoot.com."] },
      { title: "2. Erhobene Daten", paragraphs: ["Wir konnen Konto-, Profil-, Anzeigen-, Nachrichten- und technische Daten wie IP und Geraeteinformationen verarbeiten."], bullets: ["Registrierungs- und Anmeldedaten", "Profil- und Anzeigeninhalte", "Support- und Kontaktkommunikation", "Sicherheits- und Nutzungsprotokolle"] },
      { title: "3. Zwecke und Rechtsgrundlagen", paragraphs: ["Wir verarbeiten Daten zur Bereitstellung des Dienstes, zur Sicherung der Plattform, zur Kommunikation und zur Erfullung gesetzlicher Pflichten.", "Soweit erforderlich wird fur optionale Verarbeitungen eine Einwilligung eingeholt."] },
      { title: "4. Weitergabe", paragraphs: ["Daten konnen mit Dienstleistern fur Hosting, Authentifizierung, E-Mail und Sicherheit geteilt werden.", "Eine Offenlegung kann erfolgen, wenn dies gesetzlich erforderlich ist oder Rechte und Sicherheit zu schutzen sind."] },
      { title: "5. Speicherfristen und Rechte", paragraphs: ["Wir speichern Daten nur solange wie fur Servicezwecke und gesetzliche Pflichten notwendig.", "Nutzer konnen je nach Fall Auskunft, Berichtigung, Loschung, Portabilitat oder Einschrankung verlangen."] },
      { title: "6. Kontakt", paragraphs: ["Datenschutzanfragen: privacy@runoot.com."] },
    ],
  },
  nl: {
    title: "Privacybeleid",
    metaTitle: "Privacybeleid | Runoot",
    metaDescription: "Hoe Runoot persoonsgegevens verzamelt, gebruikt en beschermt.",
    updatedAt: "2 maart 2026",
    summary: "Dit beleid legt uit hoe persoonsgegevens op Runoot worden verwerkt.",
    sections: [
      { title: "1. Verwerkingsverantwoordelijke", paragraphs: ["Gegevens van de verantwoordelijke staan in de juridische kennisgeving van Runoot.", "Voor privacyverzoeken: privacy@runoot.com."] },
      { title: "2. Gegevens die we verzamelen", paragraphs: ["We kunnen account-, profiel-, advertentie-, bericht- en technische gegevens zoals IP en apparaatinfo verwerken."], bullets: ["Registratie- en inloggegevens", "Profiel- en advertentie-inhoud", "Support- en contactcommunicatie", "Beveiligings- en gebruikslogs"] },
      { title: "3. Doelen en rechtsgrond", paragraphs: ["We verwerken gegevens om de dienst te leveren, het platform te beveiligen, met gebruikers te communiceren en wettelijke plichten na te komen.", "Waar nodig vragen we toestemming voor optionele verwerkingen."] },
      { title: "4. Delen van gegevens", paragraphs: ["Gegevens kunnen worden gedeeld met dienstverleners voor hosting, authenticatie, e-mail en beveiliging.", "Openbaarmaking kan plaatsvinden wanneer wettelijk vereist of ter bescherming van rechten en veiligheid."] },
      { title: "5. Bewaartermijnen en rechten", paragraphs: ["We bewaren gegevens alleen zolang nodig voor dienstverlening en wettelijke verplichtingen.", "Gebruikers kunnen, waar van toepassing, verzoeken om inzage, correctie, verwijdering, overdraagbaarheid of beperking."] },
      { title: "6. Contact", paragraphs: ["Privacyverzoeken: privacy@runoot.com."] },
    ],
  },
  pt: {
    title: "Politica de Privacidade",
    metaTitle: "Politica de Privacidade | Runoot",
    metaDescription: "Como a Runoot coleta, usa e protege dados pessoais.",
    updatedAt: "2 de marco de 2026",
    summary: "Esta politica explica como dados pessoais sao tratados na Runoot.",
    sections: [
      { title: "1. Controlador", paragraphs: ["Os dados do controlador estao nas notas legais da Runoot.", "Para privacidade: privacy@runoot.com."] },
      { title: "2. Dados coletados", paragraphs: ["Podemos tratar dados de conta, perfil, anuncios, mensagens e dados tecnicos como IP e dispositivo."], bullets: ["Dados de cadastro e login", "Conteudo de perfil e anuncios", "Comunicacoes de suporte e contato", "Logs de seguranca e uso"] },
      { title: "3. Finalidades e bases legais", paragraphs: ["Tratamos dados para prestar o servico, proteger a plataforma, comunicar com usuarios e cumprir obrigacoes legais.", "Quando necessario, solicitamos consentimento para tratamentos opcionais."] },
      { title: "4. Compartilhamento", paragraphs: ["Dados podem ser compartilhados com prestadores de hospedagem, autenticacao, email e seguranca.", "Tambem podem ser divulgados quando exigido por lei ou para proteger direitos e seguranca."] },
      { title: "5. Retencao e direitos", paragraphs: ["Mantemos dados apenas pelo tempo necessario para finalidades de servico e obrigacoes legais.", "Usuarios podem solicitar acesso, correcao, exclusao, portabilidade ou restricao quando aplicavel."] },
      { title: "6. Contato", paragraphs: ["Solicitacoes de privacidade: privacy@runoot.com."] },
    ],
  },
};

const COOKIES: Record<SupportedLocale, LegalPolicyDocument> = {
  en: {
    title: "Cookie Policy",
    metaTitle: "Cookie Policy | Runoot",
    metaDescription: "How Runoot uses cookies and similar technologies.",
    updatedAt: "March 2, 2026",
    summary: "This Policy explains what cookies are and how we use them.",
    sections: [
      { title: "1. What Cookies Are", paragraphs: ["Cookies are small text files stored on your device to support site functionality and preferences."] },
      { title: "2. Cookie Categories", paragraphs: ["Runoot uses essential cookies and may use optional analytics cookies based on your consent."], bullets: ["Essential cookies: login, security, session, language", "Preference cookies: remember settings", "Analytics cookies: improve performance and UX"] },
      { title: "3. Consent Management", paragraphs: ["You can accept or reject optional cookies in the cookie banner and update preferences later.", "Essential cookies remain active because they are required for core functionality."] },
      { title: "4. Third Parties", paragraphs: ["Some cookies can be set by trusted third-party providers used for authentication, hosting, or analytics."] },
      { title: "5. Duration", paragraphs: ["Cookies can be session cookies or persistent cookies with a defined expiration period."] },
      { title: "6. Contact", paragraphs: ["For cookie questions: privacy@runoot.com."] },
    ],
  },
  it: {
    title: "Cookie Policy",
    metaTitle: "Cookie Policy | Runoot",
    metaDescription: "Come Runoot utilizza cookie e tecnologie simili.",
    updatedAt: "2 marzo 2026",
    summary: "Questa Policy spiega cosa sono i cookie e come li utilizziamo.",
    sections: [
      { title: "1. Cosa sono i cookie", paragraphs: ["I cookie sono piccoli file di testo salvati sul dispositivo per supportare funzioni e preferenze del sito."] },
      { title: "2. Categorie di cookie", paragraphs: ["Runoot usa cookie essenziali e puo usare cookie analitici opzionali in base al consenso."], bullets: ["Cookie essenziali: login, sicurezza, sessione, lingua", "Cookie preferenze: memorizzazione impostazioni", "Cookie analitici: miglioramento performance ed esperienza"] },
      { title: "3. Gestione consenso", paragraphs: ["Puoi accettare o rifiutare cookie opzionali dal banner e aggiornare preferenze in seguito.", "I cookie essenziali restano attivi perche necessari al funzionamento base."] },
      { title: "4. Terze parti", paragraphs: ["Alcuni cookie possono essere impostati da fornitori terzi affidabili usati per autenticazione, hosting o analytics."] },
      { title: "5. Durata", paragraphs: ["I cookie possono essere di sessione o persistenti con una scadenza definita."] },
      { title: "6. Contatti", paragraphs: ["Per domande sui cookie: privacy@runoot.com."] },
    ],
  },
  es: {
    title: "Politica de Cookies",
    metaTitle: "Politica de Cookies | Runoot",
    metaDescription: "Como Runoot usa cookies y tecnologias similares.",
    updatedAt: "2 de marzo de 2026",
    summary: "Esta Politica explica que son las cookies y como las usamos.",
    sections: [
      { title: "1. Que son las cookies", paragraphs: ["Las cookies son pequenos archivos de texto almacenados en tu dispositivo para funciones y preferencias del sitio."] },
      { title: "2. Categorias de cookies", paragraphs: ["Runoot usa cookies esenciales y puede usar cookies analiticas opcionales segun tu consentimiento."], bullets: ["Cookies esenciales: inicio de sesion, seguridad, sesion, idioma", "Cookies de preferencias: recordar configuracion", "Cookies analiticas: mejorar rendimiento y experiencia"] },
      { title: "3. Gestion del consentimiento", paragraphs: ["Puedes aceptar o rechazar cookies opcionales en el banner y actualizar preferencias despues.", "Las cookies esenciales permanecen activas porque son necesarias para funciones basicas."] },
      { title: "4. Terceros", paragraphs: ["Algunas cookies pueden ser establecidas por proveedores de confianza usados para autenticacion, hosting o analitica."] },
      { title: "5. Duracion", paragraphs: ["Las cookies pueden ser de sesion o persistentes con una expiracion definida."] },
      { title: "6. Contacto", paragraphs: ["Para consultas sobre cookies: privacy@runoot.com."] },
    ],
  },
  fr: {
    title: "Politique relative aux cookies",
    metaTitle: "Politique relative aux cookies | Runoot",
    metaDescription: "Comment Runoot utilise les cookies et technologies similaires.",
    updatedAt: "2 mars 2026",
    summary: "Cette politique explique ce que sont les cookies et comment nous les utilisons.",
    sections: [
      { title: "1. Definition des cookies", paragraphs: ["Les cookies sont de petits fichiers texte stockes sur votre appareil pour les fonctions et preferences du site."] },
      { title: "2. Categories de cookies", paragraphs: ["Runoot utilise des cookies essentiels et peut utiliser des cookies analytiques optionnels selon votre consentement."], bullets: ["Cookies essentiels: connexion, securite, session, langue", "Cookies de preferences: memoriser les reglages", "Cookies analytiques: ameliorer performance et experience"] },
      { title: "3. Gestion du consentement", paragraphs: ["Vous pouvez accepter ou refuser les cookies optionnels via le bandeau puis modifier vos preferences.", "Les cookies essentiels restent actifs car necessaires au fonctionnement principal."] },
      { title: "4. Tiers", paragraphs: ["Certains cookies peuvent etre definis par des prestataires tiers de confiance utilises pour authentification, hebergement ou analytique."] },
      { title: "5. Duree", paragraphs: ["Les cookies peuvent etre de session ou persistants avec une date d'expiration definie."] },
      { title: "6. Contact", paragraphs: ["Pour les questions cookies: privacy@runoot.com."] },
    ],
  },
  de: {
    title: "Cookie-Richtlinie",
    metaTitle: "Cookie-Richtlinie | Runoot",
    metaDescription: "Wie Runoot Cookies und ahnliche Technologien verwendet.",
    updatedAt: "2. Marz 2026",
    summary: "Diese Richtlinie erklart, was Cookies sind und wie wir sie nutzen.",
    sections: [
      { title: "1. Was Cookies sind", paragraphs: ["Cookies sind kleine Textdateien auf Ihrem Gerat, die Funktionen und Einstellungen der Website unterstutzen."] },
      { title: "2. Cookie-Kategorien", paragraphs: ["Runoot nutzt essenzielle Cookies und kann mit Ihrer Einwilligung optionale Analyse-Cookies nutzen."], bullets: ["Essenzielle Cookies: Login, Sicherheit, Sitzung, Sprache", "Praferenz-Cookies: Einstellungen merken", "Analyse-Cookies: Leistung und Nutzererlebnis verbessern"] },
      { title: "3. Einwilligungsverwaltung", paragraphs: ["Sie konnen optionale Cookies im Banner akzeptieren oder ablehnen und spater anpassen.", "Essenzielle Cookies bleiben aktiv, da sie fur Kernfunktionen notwendig sind."] },
      { title: "4. Drittanbieter", paragraphs: ["Einige Cookies konnen von vertrauenswurdigen Drittanbietern fur Authentifizierung, Hosting oder Analyse gesetzt werden."] },
      { title: "5. Speicherdauer", paragraphs: ["Cookies konnen Sitzungs-Cookies oder persistente Cookies mit definierter Laufzeit sein."] },
      { title: "6. Kontakt", paragraphs: ["Fragen zu Cookies: privacy@runoot.com."] },
    ],
  },
  nl: {
    title: "Cookiebeleid",
    metaTitle: "Cookiebeleid | Runoot",
    metaDescription: "Hoe Runoot cookies en vergelijkbare technologieen gebruikt.",
    updatedAt: "2 maart 2026",
    summary: "Dit beleid legt uit wat cookies zijn en hoe we ze gebruiken.",
    sections: [
      { title: "1. Wat cookies zijn", paragraphs: ["Cookies zijn kleine tekstbestanden op je apparaat die websitefuncties en voorkeuren ondersteunen."] },
      { title: "2. Cookiecategorieen", paragraphs: ["Runoot gebruikt essentiele cookies en kan optionele analytics-cookies gebruiken met jouw toestemming."], bullets: ["Essentiele cookies: login, beveiliging, sessie, taal", "Voorkeurscookies: instellingen onthouden", "Analytics-cookies: prestaties en gebruikerservaring verbeteren"] },
      { title: "3. Toestemmingsbeheer", paragraphs: ["Je kunt optionele cookies accepteren of weigeren in de banner en voorkeuren later aanpassen.", "Essentiele cookies blijven actief omdat ze nodig zijn voor basisfunctionaliteit."] },
      { title: "4. Derde partijen", paragraphs: ["Sommige cookies kunnen worden geplaatst door vertrouwde derde partijen voor authenticatie, hosting of analytics."] },
      { title: "5. Bewaartermijn", paragraphs: ["Cookies kunnen sessiecookies of persistente cookies met een bepaalde looptijd zijn."] },
      { title: "6. Contact", paragraphs: ["Vragen over cookies: privacy@runoot.com."] },
    ],
  },
  pt: {
    title: "Politica de Cookies",
    metaTitle: "Politica de Cookies | Runoot",
    metaDescription: "Como a Runoot usa cookies e tecnologias semelhantes.",
    updatedAt: "2 de marco de 2026",
    summary: "Esta politica explica o que sao cookies e como os usamos.",
    sections: [
      { title: "1. O que sao cookies", paragraphs: ["Cookies sao pequenos arquivos de texto salvos no seu dispositivo para suportar funcoes e preferencias do site."] },
      { title: "2. Categorias de cookies", paragraphs: ["A Runoot usa cookies essenciais e pode usar cookies analiticos opcionais com seu consentimento."], bullets: ["Cookies essenciais: login, seguranca, sessao, idioma", "Cookies de preferencia: lembrar configuracoes", "Cookies analiticos: melhorar desempenho e experiencia"] },
      { title: "3. Gestao de consentimento", paragraphs: ["Voce pode aceitar ou recusar cookies opcionais no banner e atualizar preferencias depois.", "Cookies essenciais permanecem ativos por serem necessarios para a funcionalidade principal."] },
      { title: "4. Terceiros", paragraphs: ["Alguns cookies podem ser definidos por provedores terceiros confiaveis usados para autenticacao, hospedagem ou analitica."] },
      { title: "5. Duracao", paragraphs: ["Cookies podem ser de sessao ou persistentes com prazo de expiracao definido."] },
      { title: "6. Contato", paragraphs: ["Duvidas sobre cookies: privacy@runoot.com."] },
    ],
  },
};

export function getLegalPolicyDocument(type: LegalPolicyType, locale: SupportedLocale): LegalPolicyDocument {
  if (type === "terms") return TERMS[locale];
  if (type === "privacy") return PRIVACY[locale];
  return COOKIES[locale];
}
