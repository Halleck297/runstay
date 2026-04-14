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
    updatedAt: "April 8, 2026",
    summary: "These Terms govern access to and use of Runoot. Please read them carefully before using the platform.",
    sections: [
      {
        title: "1. Scope",
        paragraphs: [
          "These Terms apply to all users of runoot.com and related services.",
          "Access to the platform is by invitation only. By creating an account and using the platform, you confirm that you have read, understood, and agree to be bound by these Terms, the Privacy Policy, and the Cookie Policy.",
        ],
      },
      {
        title: "2. Platform Role",
        paragraphs: [
          "Runoot is a listing and matching platform that connects users interested in exchanging hotel rooms, marathon bibs, and travel packages.",
          "Runoot is not a party to any agreement, transaction, or contract between users. Runoot does not process, facilitate, or intermediate payments between users in any way.",
          "Runoot does not verify, endorse, or guarantee the accuracy, legality, or quality of any listing, offer, or user profile published on the platform.",
        ],
      },
      {
        title: "3. Eligibility",
        paragraphs: [
          "You must be at least 18 years old and have full legal capacity to enter into binding agreements in your jurisdiction to use this platform.",
          "By creating an account, you represent and warrant that you meet these requirements.",
        ],
      },
      {
        title: "4. User Accounts",
        paragraphs: [
          "Each user may maintain only one account. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account.",
          "You must notify Runoot immediately at legal@runoot.com if you become aware of any unauthorized use of your account.",
        ],
      },
      {
        title: "5. User Obligations",
        paragraphs: [
          "Users must provide accurate, complete, and up-to-date information and comply with all applicable laws, regulations, and event rules.",
        ],
        bullets: [
          "Do not publish unlawful, misleading, or fraudulent listings.",
          "Do not impersonate other people or entities.",
          "Do not use the platform for fraud, abuse, or any illegal activity.",
          "Do not interfere with the proper functioning of the platform.",
        ],
      },
      {
        title: "6. User Content and Intellectual Property",
        paragraphs: [
          "You retain ownership of the content you publish on the platform (listings, messages, profile information). By publishing content, you grant Runoot a non-exclusive, worldwide, royalty-free license to display, reproduce, and distribute such content solely for the purpose of operating and providing the platform service.",
          "This license terminates when you delete the content or your account, except where the content has been shared with other users or is required for legal compliance.",
          "All Runoot branding, logos, design, software, and platform infrastructure are the exclusive property of Runoot and may not be copied, modified, or used without prior written consent.",
        ],
      },
      {
        title: "7. Prohibited Activities",
        paragraphs: [
          "The following activities are strictly prohibited:",
        ],
        bullets: [
          "Scraping, crawling, or automated extraction of data from the platform.",
          "Reverse engineering, decompiling, or disassembling any part of the platform.",
          "Using automated tools, bots, or scripts to access or interact with the platform.",
          "Reselling, sublicensing, or commercially exploiting platform data or access.",
          "Attempting to circumvent security measures or access restrictions.",
        ],
      },
      {
        title: "8. Disclaimer of Warranties and Limitation of Liability",
        paragraphs: [
          "The platform is provided \"as is\" and \"as available\" without warranties of any kind, whether express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.",
          "Transactions between users occur directly and entirely at the users' own risk. Runoot assumes no responsibility for the conduct, reliability, or solvency of any user, nor for the outcome of any transaction arranged through the platform.",
          "To the maximum extent permitted by applicable law, Runoot shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or in connection with the use of the platform.",
        ],
      },
      {
        title: "9. Suspension and Termination",
        paragraphs: [
          "Runoot may suspend or terminate accounts that violate these Terms, applicable laws, or that Runoot reasonably considers to pose a risk to the platform, other users, or third parties.",
          "Users may request the deletion of their account at any time by contacting legal@runoot.com. Upon account deletion, your personal data will be handled in accordance with the Privacy Policy.",
        ],
      },
      {
        title: "10. Modifications to These Terms",
        paragraphs: [
          "Runoot reserves the right to modify these Terms at any time. Users will be notified of material changes via email or a notice on the platform.",
          "Continued use of the platform after such notification constitutes acceptance of the updated Terms. If you do not agree with the changes, you must stop using the platform and may request account deletion.",
        ],
      },
      {
        title: "11. Governing Law and Jurisdiction",
        paragraphs: [
          "These Terms are governed by and construed in accordance with the laws of Italy.",
          "Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of Milan, Italy, without prejudice to any mandatory consumer protection provisions that may apply in the user's country of residence.",
        ],
      },
      {
        title: "12. Contact",
        paragraphs: [
          "For any legal questions or requests related to these Terms, contact: legal@runoot.com.",
        ],
      },
    ],
  },
  it: {
    title: "Termini di Servizio",
    metaTitle: "Termini di Servizio | Runoot",
    metaDescription: "Termini di Servizio per l'utilizzo della piattaforma Runoot.",
    updatedAt: "8 aprile 2026",
    summary: "I presenti Termini regolano l'accesso e l'uso di Runoot. Si prega di leggerli attentamente prima di utilizzare la piattaforma.",
    sections: [
      {
        title: "1. Ambito di applicazione",
        paragraphs: [
          "I presenti Termini si applicano a tutti gli utenti di runoot.com e dei servizi collegati.",
          "L'accesso alla piattaforma avviene esclusivamente su invito. Creando un account e utilizzando la piattaforma, confermi di aver letto, compreso e accettato i presenti Termini, la Privacy Policy e la Cookie Policy.",
        ],
      },
      {
        title: "2. Ruolo della piattaforma",
        paragraphs: [
          "Runoot e una piattaforma di annunci e matching che mette in contatto utenti interessati allo scambio di camere d'albergo, pettorali per maratone e pacchetti viaggio.",
          "Runoot non e parte di alcun accordo, transazione o contratto tra utenti. Runoot non gestisce, facilita o intermedia pagamenti tra utenti in alcun modo.",
          "Runoot non verifica, approva o garantisce l'accuratezza, la legalita o la qualita di alcun annuncio, offerta o profilo utente pubblicato sulla piattaforma.",
        ],
      },
      {
        title: "3. Requisiti di accesso",
        paragraphs: [
          "Per utilizzare la piattaforma devi avere almeno 18 anni e la piena capacita giuridica di stipulare accordi vincolanti nella tua giurisdizione.",
          "Creando un account, dichiari e garantisci di soddisfare tali requisiti.",
        ],
      },
      {
        title: "4. Account utente",
        paragraphs: [
          "Ogni utente puo mantenere un solo account. Sei responsabile della riservatezza delle tue credenziali di accesso e di tutta l'attivita che avviene sotto il tuo account.",
          "Devi comunicare immediatamente a Runoot all'indirizzo legal@runoot.com qualsiasi uso non autorizzato del tuo account.",
        ],
      },
      {
        title: "5. Obblighi dell'utente",
        paragraphs: [
          "Gli utenti devono fornire informazioni accurate, complete e aggiornate e rispettare tutte le leggi, i regolamenti e le regole degli eventi applicabili.",
        ],
        bullets: [
          "Non pubblicare annunci illeciti, ingannevoli o fraudolenti.",
          "Non impersonare altre persone o entita.",
          "Non utilizzare la piattaforma per frodi, abusi o attivita illegali.",
          "Non interferire con il corretto funzionamento della piattaforma.",
        ],
      },
      {
        title: "6. Contenuti utente e proprieta intellettuale",
        paragraphs: [
          "Mantieni la proprieta dei contenuti che pubblichi sulla piattaforma (annunci, messaggi, informazioni del profilo). Pubblicando contenuti, concedi a Runoot una licenza non esclusiva, mondiale e gratuita per visualizzare, riprodurre e distribuire tali contenuti al solo fine di operare e fornire il servizio della piattaforma.",
          "Questa licenza termina quando elimini il contenuto o il tuo account, salvo dove il contenuto sia stato condiviso con altri utenti o sia necessario per adempimenti legali.",
          "Tutti i marchi, loghi, design, software e infrastruttura della piattaforma Runoot sono proprieta esclusiva di Runoot e non possono essere copiati, modificati o utilizzati senza previo consenso scritto.",
        ],
      },
      {
        title: "7. Attivita vietate",
        paragraphs: [
          "Le seguenti attivita sono severamente vietate:",
        ],
        bullets: [
          "Scraping, crawling o estrazione automatizzata di dati dalla piattaforma.",
          "Reverse engineering, decompilazione o disassemblaggio di qualsiasi parte della piattaforma.",
          "Utilizzo di strumenti automatizzati, bot o script per accedere o interagire con la piattaforma.",
          "Rivendita, sublicenza o sfruttamento commerciale dei dati o dell'accesso alla piattaforma.",
          "Tentativo di eludere misure di sicurezza o restrizioni di accesso.",
        ],
      },
      {
        title: "8. Esclusione di garanzie e limitazione di responsabilita",
        paragraphs: [
          "La piattaforma e fornita \"cosi com'e\" e \"come disponibile\" senza garanzie di alcun tipo, espresse o implicite, incluse ma non limitate a garanzie di commerciabilita, idoneita a uno scopo particolare o non violazione.",
          "Le transazioni tra utenti avvengono direttamente e interamente a rischio degli utenti stessi. Runoot non assume alcuna responsabilita per la condotta, l'affidabilita o la solvibilita di alcun utente, ne per l'esito di alcuna transazione organizzata tramite la piattaforma.",
          "Nella misura massima consentita dalla legge applicabile, Runoot non sara responsabile per danni indiretti, incidentali, speciali, consequenziali o punitivi derivanti dall'uso della piattaforma.",
        ],
      },
      {
        title: "9. Sospensione e chiusura",
        paragraphs: [
          "Runoot puo sospendere o chiudere account che violano i presenti Termini, le leggi applicabili, o che Runoot ritenga ragionevolmente costituiscano un rischio per la piattaforma, altri utenti o terzi.",
          "Gli utenti possono richiedere la cancellazione del proprio account in qualsiasi momento contattando legal@runoot.com. In caso di cancellazione, i dati personali saranno trattati in conformita con la Privacy Policy.",
        ],
      },
      {
        title: "10. Modifiche ai presenti Termini",
        paragraphs: [
          "Runoot si riserva il diritto di modificare i presenti Termini in qualsiasi momento. Gli utenti saranno informati delle modifiche sostanziali tramite email o avviso sulla piattaforma.",
          "L'uso continuato della piattaforma dopo tale notifica costituisce accettazione dei Termini aggiornati. Se non sei d'accordo con le modifiche, devi cessare l'uso della piattaforma e puoi richiedere la cancellazione dell'account.",
        ],
      },
      {
        title: "11. Legge applicabile e foro competente",
        paragraphs: [
          "I presenti Termini sono regolati e interpretati in conformita con le leggi italiane.",
          "Qualsiasi controversia derivante da o in relazione ai presenti Termini sara di competenza esclusiva del Foro di Milano, Italia, fatto salvo quanto previsto dalle norme inderogabili a tutela del consumatore applicabili nel paese di residenza dell'utente.",
        ],
      },
      {
        title: "12. Contatti",
        paragraphs: [
          "Per qualsiasi domanda o richiesta legale relativa ai presenti Termini, contattare: legal@runoot.com.",
        ],
      },
    ],
  },
  es: {
    title: "Terminos del Servicio",
    metaTitle: "Terminos del Servicio | Runoot",
    metaDescription: "Terminos del Servicio para usar la plataforma Runoot.",
    updatedAt: "8 de abril de 2026",
    summary: "Estos Terminos regulan el acceso y uso de Runoot. Lea atentamente antes de utilizar la plataforma.",
    sections: [
      {
        title: "1. Alcance",
        paragraphs: [
          "Estos Terminos se aplican a todos los usuarios de runoot.com y servicios relacionados.",
          "El acceso a la plataforma es solo por invitacion. Al crear una cuenta y usar la plataforma, confirmas que has leido, comprendido y aceptado estos Terminos, la Politica de Privacidad y la Politica de Cookies.",
        ],
      },
      {
        title: "2. Rol de la plataforma",
        paragraphs: [
          "Runoot es una plataforma de anuncios y emparejamiento que conecta usuarios interesados en intercambiar habitaciones de hotel, dorsales de maraton y paquetes de viaje.",
          "Runoot no es parte de ningun acuerdo, transaccion o contrato entre usuarios. Runoot no procesa, facilita ni intermedia pagos entre usuarios de ninguna manera.",
          "Runoot no verifica, respalda ni garantiza la exactitud, legalidad o calidad de ningun anuncio, oferta o perfil de usuario publicado en la plataforma.",
        ],
      },
      {
        title: "3. Requisitos de acceso",
        paragraphs: [
          "Debes tener al menos 18 anos y plena capacidad juridica para celebrar acuerdos vinculantes en tu jurisdiccion para utilizar esta plataforma.",
          "Al crear una cuenta, declaras y garantizas que cumples estos requisitos.",
        ],
      },
      {
        title: "4. Cuentas de usuario",
        paragraphs: [
          "Cada usuario puede mantener una sola cuenta. Eres responsable de la confidencialidad de tus credenciales de acceso y de toda la actividad bajo tu cuenta.",
          "Debes notificar inmediatamente a Runoot en legal@runoot.com si detectas cualquier uso no autorizado de tu cuenta.",
        ],
      },
      {
        title: "5. Obligaciones del usuario",
        paragraphs: [
          "Los usuarios deben proporcionar informacion precisa, completa y actualizada y cumplir con todas las leyes, regulaciones y reglas de eventos aplicables.",
        ],
        bullets: [
          "No publicar anuncios ilegales, enganosos o fraudulentos.",
          "No suplantar a otras personas o entidades.",
          "No usar la plataforma para fraude, abuso o actividades ilegales.",
          "No interferir con el correcto funcionamiento de la plataforma.",
        ],
      },
      {
        title: "6. Contenido del usuario y propiedad intelectual",
        paragraphs: [
          "Conservas la propiedad del contenido que publicas en la plataforma (anuncios, mensajes, informacion de perfil). Al publicar contenido, otorgas a Runoot una licencia no exclusiva, mundial y gratuita para mostrar, reproducir y distribuir dicho contenido unicamente para operar y proporcionar el servicio de la plataforma.",
          "Esta licencia finaliza cuando eliminas el contenido o tu cuenta, excepto cuando el contenido haya sido compartido con otros usuarios o sea necesario para cumplimiento legal.",
          "Todas las marcas, logotipos, diseno, software e infraestructura de Runoot son propiedad exclusiva de Runoot y no pueden copiarse, modificarse ni utilizarse sin consentimiento previo por escrito.",
        ],
      },
      {
        title: "7. Actividades prohibidas",
        paragraphs: [
          "Las siguientes actividades estan estrictamente prohibidas:",
        ],
        bullets: [
          "Scraping, crawling o extraccion automatizada de datos de la plataforma.",
          "Ingenieria inversa, descompilacion o desensamblaje de cualquier parte de la plataforma.",
          "Uso de herramientas automatizadas, bots o scripts para acceder o interactuar con la plataforma.",
          "Reventa, sublicencia o explotacion comercial de datos o acceso a la plataforma.",
          "Intento de eludir medidas de seguridad o restricciones de acceso.",
        ],
      },
      {
        title: "8. Exencion de garantias y limitacion de responsabilidad",
        paragraphs: [
          "La plataforma se proporciona \"tal cual\" y \"segun disponibilidad\" sin garantias de ningun tipo, expresas o implicitas, incluyendo pero no limitadas a garantias de comerciabilidad, idoneidad para un fin particular o no infraccion.",
          "Las transacciones entre usuarios se realizan directamente y bajo el exclusivo riesgo de los usuarios. Runoot no asume responsabilidad alguna por la conducta, fiabilidad o solvencia de ningun usuario, ni por el resultado de ninguna transaccion organizada a traves de la plataforma.",
          "En la maxima medida permitida por la ley aplicable, Runoot no sera responsable por danos indirectos, incidentales, especiales, consecuentes o punitivos derivados del uso de la plataforma.",
        ],
      },
      {
        title: "9. Suspension y cierre",
        paragraphs: [
          "Runoot puede suspender o cerrar cuentas que violen estos Terminos, la ley aplicable, o que Runoot considere razonablemente que representan un riesgo para la plataforma, otros usuarios o terceros.",
          "Los usuarios pueden solicitar la eliminacion de su cuenta en cualquier momento contactando a legal@runoot.com. Tras la eliminacion de la cuenta, tus datos personales se gestionaran conforme a la Politica de Privacidad.",
        ],
      },
      {
        title: "10. Modificaciones a estos Terminos",
        paragraphs: [
          "Runoot se reserva el derecho de modificar estos Terminos en cualquier momento. Los usuarios seran notificados de cambios sustanciales por email o aviso en la plataforma.",
          "El uso continuado de la plataforma tras dicha notificacion constituye aceptacion de los Terminos actualizados. Si no estas de acuerdo con los cambios, debes dejar de usar la plataforma y puedes solicitar la eliminacion de tu cuenta.",
        ],
      },
      {
        title: "11. Ley aplicable y jurisdiccion",
        paragraphs: [
          "Estos Terminos se rigen e interpretan de conformidad con las leyes de Italia.",
          "Cualquier controversia derivada de o relacionada con estos Terminos estara sujeta a la jurisdiccion exclusiva de los tribunales de Milan, Italia, sin perjuicio de las disposiciones imperativas de proteccion al consumidor aplicables en el pais de residencia del usuario.",
        ],
      },
      {
        title: "12. Contacto",
        paragraphs: [
          "Para cualquier consulta o solicitud legal relacionada con estos Terminos, contactar: legal@runoot.com.",
        ],
      },
    ],
  },
  fr: {
    title: "Conditions d'utilisation",
    metaTitle: "Conditions d'utilisation | Runoot",
    metaDescription: "Conditions d'utilisation de la plateforme Runoot.",
    updatedAt: "8 avril 2026",
    summary: "Ces conditions regissent l'acces et l'utilisation de Runoot. Veuillez les lire attentivement avant d'utiliser la plateforme.",
    sections: [
      {
        title: "1. Champ d'application",
        paragraphs: [
          "Ces conditions s'appliquent a tous les utilisateurs de runoot.com et des services associes.",
          "L'acces a la plateforme se fait uniquement sur invitation. En creant un compte et en utilisant la plateforme, vous confirmez avoir lu, compris et accepte ces conditions, la politique de confidentialite et la politique de cookies.",
        ],
      },
      {
        title: "2. Role de la plateforme",
        paragraphs: [
          "Runoot est une plateforme d'annonces et de mise en relation connectant des utilisateurs interesses par l'echange de chambres d'hotel, de dossards de marathon et de forfaits voyage.",
          "Runoot n'est partie a aucun accord, transaction ou contrat entre utilisateurs. Runoot ne traite, ne facilite ni n'intermedie de paiements entre utilisateurs d'aucune maniere.",
          "Runoot ne verifie, n'approuve ni ne garantit l'exactitude, la legalite ou la qualite d'aucune annonce, offre ou profil utilisateur publie sur la plateforme.",
        ],
      },
      {
        title: "3. Conditions d'acces",
        paragraphs: [
          "Vous devez avoir au moins 18 ans et la pleine capacite juridique pour conclure des accords contraignants dans votre juridiction pour utiliser cette plateforme.",
          "En creant un compte, vous declarez et garantissez remplir ces conditions.",
        ],
      },
      {
        title: "4. Comptes utilisateurs",
        paragraphs: [
          "Chaque utilisateur ne peut disposer que d'un seul compte. Vous etes responsable de la confidentialite de vos identifiants de connexion et de toute activite effectuee sous votre compte.",
          "Vous devez notifier immediatement Runoot a legal@runoot.com si vous constatez une utilisation non autorisee de votre compte.",
        ],
      },
      {
        title: "5. Obligations de l'utilisateur",
        paragraphs: [
          "Les utilisateurs doivent fournir des informations exactes, completes et a jour et respecter toutes les lois, reglementations et regles d'evenements applicables.",
        ],
        bullets: [
          "Ne pas publier d'annonces illegales, trompeuses ou frauduleuses.",
          "Ne pas usurper l'identite d'autres personnes ou entites.",
          "Ne pas utiliser la plateforme a des fins de fraude, d'abus ou d'activites illegales.",
          "Ne pas interferer avec le bon fonctionnement de la plateforme.",
        ],
      },
      {
        title: "6. Contenu utilisateur et propriete intellectuelle",
        paragraphs: [
          "Vous conservez la propriete du contenu que vous publiez sur la plateforme (annonces, messages, informations de profil). En publiant du contenu, vous accordez a Runoot une licence non exclusive, mondiale et gratuite pour afficher, reproduire et distribuer ce contenu uniquement aux fins d'exploiter et de fournir le service de la plateforme.",
          "Cette licence prend fin lorsque vous supprimez le contenu ou votre compte, sauf lorsque le contenu a ete partage avec d'autres utilisateurs ou est necessaire pour le respect d'obligations legales.",
          "Toutes les marques, logos, designs, logiciels et infrastructures de Runoot sont la propriete exclusive de Runoot et ne peuvent etre copies, modifies ou utilises sans consentement ecrit prealable.",
        ],
      },
      {
        title: "7. Activites interdites",
        paragraphs: [
          "Les activites suivantes sont strictement interdites :",
        ],
        bullets: [
          "Scraping, crawling ou extraction automatisee de donnees de la plateforme.",
          "Ingenierie inverse, decompilation ou desassemblage de toute partie de la plateforme.",
          "Utilisation d'outils automatises, de bots ou de scripts pour acceder ou interagir avec la plateforme.",
          "Revente, sous-licence ou exploitation commerciale des donnees ou de l'acces a la plateforme.",
          "Tentative de contourner les mesures de securite ou les restrictions d'acces.",
        ],
      },
      {
        title: "8. Exclusion de garanties et limitation de responsabilite",
        paragraphs: [
          "La plateforme est fournie \"en l'etat\" et \"selon disponibilite\" sans garantie d'aucune sorte, expresse ou implicite, y compris mais sans s'y limiter les garanties de qualite marchande, d'adequation a un usage particulier ou de non-contrefacon.",
          "Les transactions entre utilisateurs se deroulent directement et entierement aux risques et perils des utilisateurs. Runoot n'assume aucune responsabilite quant a la conduite, la fiabilite ou la solvabilite de tout utilisateur, ni quant au resultat de toute transaction organisee via la plateforme.",
          "Dans la mesure maximale autorisee par la loi applicable, Runoot ne sera pas responsable des dommages indirects, accessoires, speciaux, consecutifs ou punitifs decoulant de l'utilisation de la plateforme.",
        ],
      },
      {
        title: "9. Suspension et resiliation",
        paragraphs: [
          "Runoot peut suspendre ou resilier les comptes qui enfreignent ces conditions, la loi applicable, ou que Runoot considere raisonnablement comme presentant un risque pour la plateforme, les autres utilisateurs ou des tiers.",
          "Les utilisateurs peuvent demander la suppression de leur compte a tout moment en contactant legal@runoot.com. Apres la suppression du compte, vos donnees personnelles seront traitees conformement a la politique de confidentialite.",
        ],
      },
      {
        title: "10. Modifications des presentes conditions",
        paragraphs: [
          "Runoot se reserve le droit de modifier ces conditions a tout moment. Les utilisateurs seront informes des modifications substantielles par email ou par un avis sur la plateforme.",
          "L'utilisation continue de la plateforme apres cette notification constitue l'acceptation des conditions mises a jour. Si vous n'acceptez pas les modifications, vous devez cesser d'utiliser la plateforme et pouvez demander la suppression de votre compte.",
        ],
      },
      {
        title: "11. Droit applicable et juridiction",
        paragraphs: [
          "Les presentes conditions sont regies et interpretees conformement au droit italien.",
          "Tout litige decoulant de ou en rapport avec ces conditions sera soumis a la competence exclusive des tribunaux de Milan, Italie, sans prejudice des dispositions imperatives de protection des consommateurs applicables dans le pays de residence de l'utilisateur.",
        ],
      },
      {
        title: "12. Contact",
        paragraphs: [
          "Pour toute question ou demande juridique relative aux presentes conditions, contacter : legal@runoot.com.",
        ],
      },
    ],
  },
  de: {
    title: "Nutzungsbedingungen",
    metaTitle: "Nutzungsbedingungen | Runoot",
    metaDescription: "Nutzungsbedingungen fuer die Runoot Plattform.",
    updatedAt: "8. April 2026",
    summary: "Diese Bedingungen regeln den Zugang zu Runoot und dessen Nutzung. Bitte lesen Sie sie sorgfaeltig, bevor Sie die Plattform nutzen.",
    sections: [
      {
        title: "1. Geltungsbereich",
        paragraphs: [
          "Diese Bedingungen gelten fuer alle Nutzer von runoot.com und zugehoerigen Diensten.",
          "Der Zugang zur Plattform erfolgt ausschliesslich auf Einladung. Mit der Erstellung eines Kontos und der Nutzung der Plattform bestaetigen Sie, dass Sie diese Bedingungen, die Datenschutzerklaerung und die Cookie-Richtlinie gelesen, verstanden und akzeptiert haben.",
        ],
      },
      {
        title: "2. Rolle der Plattform",
        paragraphs: [
          "Runoot ist eine Anzeigen- und Matching-Plattform, die Nutzer verbindet, die am Austausch von Hotelzimmern, Marathon-Startnummern und Reisepaketen interessiert sind.",
          "Runoot ist keine Partei irgendeiner Vereinbarung, Transaktion oder eines Vertrags zwischen Nutzern. Runoot verarbeitet, vermittelt oder intermediiert in keiner Weise Zahlungen zwischen Nutzern.",
          "Runoot ueberprueft, befuerwortet oder garantiert nicht die Richtigkeit, Rechtmaessigkeit oder Qualitaet von Anzeigen, Angeboten oder Nutzerprofilen auf der Plattform.",
        ],
      },
      {
        title: "3. Zugangsvoraussetzungen",
        paragraphs: [
          "Sie muessen mindestens 18 Jahre alt sein und die volle Geschaeftsfaehigkeit besitzen, um verbindliche Vereinbarungen in Ihrer Rechtsordnung abzuschliessen.",
          "Mit der Erstellung eines Kontos erklaeren und gewaehrleisten Sie, dass Sie diese Voraussetzungen erfuellen.",
        ],
      },
      {
        title: "4. Benutzerkonten",
        paragraphs: [
          "Jeder Nutzer darf nur ein Konto fuehren. Sie sind verantwortlich fuer die Vertraulichkeit Ihrer Zugangsdaten und fuer alle Aktivitaeten unter Ihrem Konto.",
          "Sie muessen Runoot unverzueglich unter legal@runoot.com informieren, wenn Sie eine unbefugte Nutzung Ihres Kontos feststellen.",
        ],
      },
      {
        title: "5. Pflichten der Nutzer",
        paragraphs: [
          "Nutzer muessen genaue, vollstaendige und aktuelle Informationen bereitstellen und alle geltenden Gesetze, Vorschriften und Veranstaltungsregeln einhalten.",
        ],
        bullets: [
          "Keine rechtswidrigen, irrefuehrenden oder betruegerischen Anzeigen veroeffentlichen.",
          "Keine Identitaetstaueschung.",
          "Die Plattform nicht fuer Betrug, Missbrauch oder illegale Aktivitaeten nutzen.",
          "Nicht in den ordnungsgemaessen Betrieb der Plattform eingreifen.",
        ],
      },
      {
        title: "6. Nutzerinhalte und geistiges Eigentum",
        paragraphs: [
          "Sie behalten das Eigentum an den Inhalten, die Sie auf der Plattform veroeffentlichen (Anzeigen, Nachrichten, Profilinformationen). Mit der Veroeffentlichung gewaehren Sie Runoot eine nicht-exklusive, weltweite, unentgeltliche Lizenz zur Anzeige, Vervielfaeltigung und Verbreitung dieser Inhalte ausschliesslich zum Zweck des Betriebs und der Bereitstellung des Plattformdienstes.",
          "Diese Lizenz endet, wenn Sie den Inhalt oder Ihr Konto loeschen, es sei denn, der Inhalt wurde mit anderen Nutzern geteilt oder ist fuer die Erfuellung gesetzlicher Pflichten erforderlich.",
          "Alle Marken, Logos, Designs, Software und die Infrastruktur der Plattform Runoot sind ausschliessliches Eigentum von Runoot und duerfen ohne vorherige schriftliche Zustimmung nicht kopiert, veraendert oder verwendet werden.",
        ],
      },
      {
        title: "7. Verbotene Aktivitaeten",
        paragraphs: [
          "Die folgenden Aktivitaeten sind streng untersagt:",
        ],
        bullets: [
          "Scraping, Crawling oder automatisierte Datenextraktion von der Plattform.",
          "Reverse Engineering, Dekompilierung oder Disassemblierung jeglicher Teile der Plattform.",
          "Verwendung automatisierter Tools, Bots oder Skripte fuer den Zugriff auf oder die Interaktion mit der Plattform.",
          "Weiterverkauf, Unterlizenzierung oder kommerzielle Verwertung von Plattformdaten oder -zugang.",
          "Versuch, Sicherheitsmassnahmen oder Zugangsbeschraenkungen zu umgehen.",
        ],
      },
      {
        title: "8. Haftungsausschluss und Haftungsbeschraenkung",
        paragraphs: [
          "Die Plattform wird \"wie besehen\" und \"wie verfuegbar\" ohne jegliche Gewaehrleistung bereitgestellt, weder ausdruecklich noch stillschweigend, einschliesslich aber nicht beschraenkt auf Gewaehrleistungen der Marktgaengigkeit, Eignung fuer einen bestimmten Zweck oder Nichtverletzung.",
          "Transaktionen zwischen Nutzern erfolgen direkt und vollstaendig auf eigenes Risiko der Nutzer. Runoot uebernimmt keine Verantwortung fuer das Verhalten, die Zuverlaessigkeit oder Zahlungsfaehigkeit eines Nutzers, noch fuer das Ergebnis einer ueber die Plattform vereinbarten Transaktion.",
          "Im groessten gesetzlich zulaessigen Umfang haftet Runoot nicht fuer indirekte, zufaellige, besondere, Folge- oder Strafschaeden, die aus der Nutzung der Plattform entstehen.",
        ],
      },
      {
        title: "9. Sperrung und Kuendigung",
        paragraphs: [
          "Runoot kann Konten sperren oder kuendigen, die gegen diese Bedingungen oder geltendes Recht verstossen oder die Runoot vernuenftigerweise als Risiko fuer die Plattform, andere Nutzer oder Dritte ansieht.",
          "Nutzer koennen jederzeit die Loeschung ihres Kontos beantragen, indem sie sich an legal@runoot.com wenden. Nach der Kontoloeschung werden Ihre personenbezogenen Daten gemaess der Datenschutzerklaerung behandelt.",
        ],
      },
      {
        title: "10. Aenderungen dieser Bedingungen",
        paragraphs: [
          "Runoot behaelt sich das Recht vor, diese Bedingungen jederzeit zu aendern. Nutzer werden ueber wesentliche Aenderungen per E-Mail oder durch einen Hinweis auf der Plattform informiert.",
          "Die fortgesetzte Nutzung der Plattform nach einer solchen Benachrichtigung gilt als Annahme der aktualisierten Bedingungen. Wenn Sie mit den Aenderungen nicht einverstanden sind, muessen Sie die Nutzung der Plattform einstellen und koennen die Kontoloeschung beantragen.",
        ],
      },
      {
        title: "11. Anwendbares Recht und Gerichtsstand",
        paragraphs: [
          "Diese Bedingungen unterliegen dem Recht Italiens und werden in Uebereinstimmung damit ausgelegt.",
          "Jeder Rechtsstreit im Zusammenhang mit diesen Bedingungen unterliegt der ausschliesslichen Zustaendigkeit der Gerichte in Mailand, Italien, unbeschadet zwingender Verbraucherschutzvorschriften im Wohnsitzland des Nutzers.",
        ],
      },
      {
        title: "12. Kontakt",
        paragraphs: [
          "Fuer rechtliche Fragen oder Anfragen zu diesen Bedingungen: legal@runoot.com.",
        ],
      },
    ],
  },
  nl: {
    title: "Gebruiksvoorwaarden",
    metaTitle: "Gebruiksvoorwaarden | Runoot",
    metaDescription: "Gebruiksvoorwaarden voor het gebruik van Runoot.",
    updatedAt: "8 april 2026",
    summary: "Deze voorwaarden regelen de toegang tot en het gebruik van Runoot. Lees ze aandachtig door voordat u het platform gebruikt.",
    sections: [
      {
        title: "1. Toepassingsgebied",
        paragraphs: [
          "Deze voorwaarden gelden voor alle gebruikers van runoot.com en verwante diensten.",
          "Toegang tot het platform is uitsluitend op uitnodiging. Door een account aan te maken en het platform te gebruiken, bevestigt u dat u deze voorwaarden, het privacybeleid en het cookiebeleid heeft gelezen, begrepen en aanvaard.",
        ],
      },
      {
        title: "2. Rol van het platform",
        paragraphs: [
          "Runoot is een advertentie- en matchingplatform dat gebruikers verbindt die geinteresseerd zijn in het uitwisselen van hotelkamers, marathonstartnummers en reispakketten.",
          "Runoot is geen partij bij enige overeenkomst, transactie of contract tussen gebruikers. Runoot verwerkt, faciliteert of bemiddelt op geen enkele wijze betalingen tussen gebruikers.",
          "Runoot verifieert, onderschrijft of garandeert niet de juistheid, wettigheid of kwaliteit van advertenties, aanbiedingen of gebruikersprofielen op het platform.",
        ],
      },
      {
        title: "3. Toegangsvereisten",
        paragraphs: [
          "U moet ten minste 18 jaar oud zijn en volledige handelingsbekwaamheid bezitten om bindende overeenkomsten aan te gaan in uw rechtsgebied.",
          "Door een account aan te maken verklaart en garandeert u aan deze vereisten te voldoen.",
        ],
      },
      {
        title: "4. Gebruikersaccounts",
        paragraphs: [
          "Elke gebruiker mag slechts een account aanhouden. U bent verantwoordelijk voor de vertrouwelijkheid van uw inloggegevens en voor alle activiteiten onder uw account.",
          "U dient Runoot onmiddellijk te informeren via legal@runoot.com als u ongeautoriseerd gebruik van uw account constateert.",
        ],
      },
      {
        title: "5. Verplichtingen van gebruikers",
        paragraphs: [
          "Gebruikers moeten nauwkeurige, volledige en actuele informatie verstrekken en alle toepasselijke wetten, regelgeving en evenementregels naleven.",
        ],
        bullets: [
          "Geen illegale, misleidende of frauduleuze advertenties plaatsen.",
          "Niet de identiteit van anderen aannemen.",
          "Het platform niet gebruiken voor fraude, misbruik of illegale activiteiten.",
          "De goede werking van het platform niet verstoren.",
        ],
      },
      {
        title: "6. Gebruikersinhoud en intellectueel eigendom",
        paragraphs: [
          "U behoudt het eigendom van de inhoud die u op het platform publiceert (advertenties, berichten, profielinformatie). Door inhoud te publiceren verleent u Runoot een niet-exclusieve, wereldwijde, royaltyvrije licentie om dergelijke inhoud te tonen, reproduceren en verspreiden uitsluitend ten behoeve van de exploitatie en levering van de platformdienst.",
          "Deze licentie eindigt wanneer u de inhoud of uw account verwijdert, tenzij de inhoud is gedeeld met andere gebruikers of nodig is voor wettelijke naleving.",
          "Alle merken, logo's, ontwerpen, software en infrastructuur van Runoot zijn het exclusieve eigendom van Runoot en mogen niet worden gekopieerd, gewijzigd of gebruikt zonder voorafgaande schriftelijke toestemming.",
        ],
      },
      {
        title: "7. Verboden activiteiten",
        paragraphs: [
          "De volgende activiteiten zijn strikt verboden:",
        ],
        bullets: [
          "Scraping, crawling of geautomatiseerde data-extractie van het platform.",
          "Reverse engineering, decompilatie of demontage van enig deel van het platform.",
          "Gebruik van geautomatiseerde tools, bots of scripts om toegang te krijgen tot of interactie te hebben met het platform.",
          "Doorverkoop, sublicentie of commerciele exploitatie van platformgegevens of -toegang.",
          "Pogingen om beveiligingsmaatregelen of toegangsbeperkingen te omzeilen.",
        ],
      },
      {
        title: "8. Uitsluiting van garanties en beperking van aansprakelijkheid",
        paragraphs: [
          "Het platform wordt geleverd \"zoals het is\" en \"zoals beschikbaar\" zonder enige garantie, expliciet of impliciet, inclusief maar niet beperkt tot garanties van verkoopbaarheid, geschiktheid voor een bepaald doel of niet-inbreuk.",
          "Transacties tussen gebruikers vinden rechtstreeks en geheel op eigen risico van de gebruikers plaats. Runoot aanvaardt geen verantwoordelijkheid voor het gedrag, de betrouwbaarheid of de solvabiliteit van enige gebruiker, noch voor de uitkomst van enige via het platform georganiseerde transactie.",
          "Voor zover maximaal toegestaan door toepasselijk recht, is Runoot niet aansprakelijk voor indirecte, incidentele, bijzondere, gevolg- of punitieve schade voortvloeiend uit het gebruik van het platform.",
        ],
      },
      {
        title: "9. Opschorting en beeindiging",
        paragraphs: [
          "Runoot kan accounts opschorten of beeindigen die deze voorwaarden of toepasselijke wetgeving schenden, of die Runoot redelijkerwijs als risico voor het platform, andere gebruikers of derden beschouwt.",
          "Gebruikers kunnen op elk moment verzoeken om verwijdering van hun account door contact op te nemen met legal@runoot.com. Na accountverwijdering worden uw persoonsgegevens behandeld conform het privacybeleid.",
        ],
      },
      {
        title: "10. Wijzigingen van deze voorwaarden",
        paragraphs: [
          "Runoot behoudt zich het recht voor deze voorwaarden op elk moment te wijzigen. Gebruikers worden via e-mail of een melding op het platform geinformeerd over wezenlijke wijzigingen.",
          "Voortgezet gebruik van het platform na een dergelijke kennisgeving geldt als aanvaarding van de bijgewerkte voorwaarden. Als u niet akkoord gaat met de wijzigingen, dient u het gebruik van het platform te staken en kunt u verwijdering van uw account aanvragen.",
        ],
      },
      {
        title: "11. Toepasselijk recht en bevoegde rechter",
        paragraphs: [
          "Op deze voorwaarden is het recht van Italie van toepassing.",
          "Elk geschil dat voortvloeit uit of verband houdt met deze voorwaarden valt onder de exclusieve bevoegdheid van de rechtbanken van Milaan, Italie, onverminderd dwingende consumentenbeschermingsbepalingen in het land van verblijf van de gebruiker.",
        ],
      },
      {
        title: "12. Contact",
        paragraphs: [
          "Voor juridische vragen of verzoeken met betrekking tot deze voorwaarden: legal@runoot.com.",
        ],
      },
    ],
  },
  pt: {
    title: "Termos de Servico",
    metaTitle: "Termos de Servico | Runoot",
    metaDescription: "Termos de Servico para usar a plataforma Runoot.",
    updatedAt: "8 de abril de 2026",
    summary: "Estes Termos regulam o acesso e uso da Runoot. Leia-os atentamente antes de utilizar a plataforma.",
    sections: [
      {
        title: "1. Escopo",
        paragraphs: [
          "Estes Termos aplicam-se a todos os usuarios de runoot.com e servicos relacionados.",
          "O acesso a plataforma e exclusivamente por convite. Ao criar uma conta e usar a plataforma, voce confirma que leu, compreendeu e concorda com estes Termos, a Politica de Privacidade e a Politica de Cookies.",
        ],
      },
      {
        title: "2. Papel da plataforma",
        paragraphs: [
          "A Runoot e uma plataforma de anuncios e correspondencia que conecta usuarios interessados na troca de quartos de hotel, dorsais de maratona e pacotes de viagem.",
          "A Runoot nao e parte de nenhum acordo, transacao ou contrato entre usuarios. A Runoot nao processa, facilita nem intermedia pagamentos entre usuarios de nenhuma forma.",
          "A Runoot nao verifica, endossa nem garante a exatidao, legalidade ou qualidade de nenhum anuncio, oferta ou perfil de usuario publicado na plataforma.",
        ],
      },
      {
        title: "3. Requisitos de acesso",
        paragraphs: [
          "Voce deve ter pelo menos 18 anos e plena capacidade juridica para celebrar acordos vinculantes em sua jurisdicao para utilizar esta plataforma.",
          "Ao criar uma conta, voce declara e garante que atende a esses requisitos.",
        ],
      },
      {
        title: "4. Contas de usuario",
        paragraphs: [
          "Cada usuario pode manter apenas uma conta. Voce e responsavel pela confidencialidade de suas credenciais de acesso e por toda a atividade em sua conta.",
          "Voce deve notificar imediatamente a Runoot em legal@runoot.com caso detecte qualquer uso nao autorizado de sua conta.",
        ],
      },
      {
        title: "5. Obrigacoes do usuario",
        paragraphs: [
          "Os usuarios devem fornecer informacoes precisas, completas e atualizadas e cumprir todas as leis, regulamentos e regras de eventos aplicaveis.",
        ],
        bullets: [
          "Nao publicar anuncios ilegais, enganosos ou fraudulentos.",
          "Nao se passar por outras pessoas ou entidades.",
          "Nao usar a plataforma para fraude, abuso ou atividades ilegais.",
          "Nao interferir no funcionamento adequado da plataforma.",
        ],
      },
      {
        title: "6. Conteudo do usuario e propriedade intelectual",
        paragraphs: [
          "Voce mantem a propriedade do conteudo que publica na plataforma (anuncios, mensagens, informacoes de perfil). Ao publicar conteudo, voce concede a Runoot uma licenca nao exclusiva, mundial e gratuita para exibir, reproduzir e distribuir tal conteudo exclusivamente para operar e fornecer o servico da plataforma.",
          "Esta licenca termina quando voce exclui o conteudo ou sua conta, exceto quando o conteudo foi compartilhado com outros usuarios ou e necessario para conformidade legal.",
          "Todas as marcas, logotipos, designs, software e infraestrutura da Runoot sao propriedade exclusiva da Runoot e nao podem ser copiados, modificados ou utilizados sem consentimento previo por escrito.",
        ],
      },
      {
        title: "7. Atividades proibidas",
        paragraphs: [
          "As seguintes atividades sao estritamente proibidas:",
        ],
        bullets: [
          "Scraping, crawling ou extracao automatizada de dados da plataforma.",
          "Engenharia reversa, descompilacao ou desmontagem de qualquer parte da plataforma.",
          "Uso de ferramentas automatizadas, bots ou scripts para acessar ou interagir com a plataforma.",
          "Revenda, sublicenciamento ou exploracao comercial de dados ou acesso a plataforma.",
          "Tentativa de contornar medidas de seguranca ou restricoes de acesso.",
        ],
      },
      {
        title: "8. Isencao de garantias e limitacao de responsabilidade",
        paragraphs: [
          "A plataforma e fornecida \"como esta\" e \"conforme disponivel\" sem garantias de qualquer tipo, expressas ou implicitas, incluindo mas nao se limitando a garantias de comercializacao, adequacao a um proposito especifico ou nao violacao.",
          "Transacoes entre usuarios ocorrem diretamente e inteiramente por conta e risco dos proprios usuarios. A Runoot nao assume nenhuma responsabilidade pela conduta, confiabilidade ou solvencia de qualquer usuario, nem pelo resultado de qualquer transacao organizada atraves da plataforma.",
          "Na maxima extensao permitida pela lei aplicavel, a Runoot nao sera responsavel por danos indiretos, incidentais, especiais, consequenciais ou punitivos decorrentes do uso da plataforma.",
        ],
      },
      {
        title: "9. Suspensao e encerramento",
        paragraphs: [
          "A Runoot pode suspender ou encerrar contas que violem estes Termos, a legislacao aplicavel, ou que a Runoot razoavelmente considere representar risco para a plataforma, outros usuarios ou terceiros.",
          "Os usuarios podem solicitar a exclusao de sua conta a qualquer momento contatando legal@runoot.com. Apos a exclusao da conta, seus dados pessoais serao tratados conforme a Politica de Privacidade.",
        ],
      },
      {
        title: "10. Alteracoes a estes Termos",
        paragraphs: [
          "A Runoot reserva-se o direito de alterar estes Termos a qualquer momento. Os usuarios serao notificados sobre alteracoes substanciais por email ou aviso na plataforma.",
          "O uso continuado da plataforma apos tal notificacao constitui aceitacao dos Termos atualizados. Se voce nao concordar com as alteracoes, deve cessar o uso da plataforma e pode solicitar a exclusao de sua conta.",
        ],
      },
      {
        title: "11. Lei aplicavel e jurisdicao",
        paragraphs: [
          "Estes Termos sao regidos e interpretados de acordo com as leis da Italia.",
          "Qualquer disputa decorrente de ou relacionada a estes Termos sera submetida a jurisdicao exclusiva dos tribunais de Milao, Italia, sem prejuizo das disposicoes obrigatorias de protecao ao consumidor aplicaveis no pais de residencia do usuario.",
        ],
      },
      {
        title: "12. Contato",
        paragraphs: [
          "Para quaisquer questoes ou solicitacoes legais relacionadas a estes Termos, contatar: legal@runoot.com.",
        ],
      },
    ],
  },
};

const PRIVACY: Record<SupportedLocale, LegalPolicyDocument> = {
  en: {
    title: "Privacy Policy",
    metaTitle: "Privacy Policy | Runoot",
    metaDescription: "How Runoot collects, uses, and protects personal data.",
    updatedAt: "April 8, 2026",
    summary: "This Policy explains how personal data is collected, used, and protected on Runoot, in accordance with Regulation (EU) 2016/679 (GDPR) and applicable data protection laws.",
    sections: [
      {
        title: "1. Data Controller",
        paragraphs: [
          "The data controller is Runoot, with registered office in Milan, Italy.",
          "For all privacy-related matters, you can contact us at: legal@runoot.com.",
        ],
      },
      {
        title: "2. Data We Collect",
        paragraphs: [
          "We may collect and process the following categories of personal data:",
        ],
        bullets: [
          "Account data: email address, password (hashed), full name, user type (tour operator or private).",
          "Profile data: company name, phone number, profile information.",
          "Listing data: listing descriptions, prices, availability, event details.",
          "Communication data: messages exchanged between users on the platform.",
          "Technical data: IP address, browser type, device information, access logs.",
          "Referral data: invitation records, referral attributions.",
        ],
      },
      {
        title: "3. Purposes and Legal Bases",
        paragraphs: [
          "We process your personal data for the following purposes and on the corresponding legal bases under Article 6(1) GDPR:",
        ],
        bullets: [
          "Service delivery (account creation, listings, messaging): contractual necessity — Art. 6(1)(b).",
          "Platform security (fraud prevention, abuse detection, access logs): legitimate interest — Art. 6(1)(f).",
          "Service communications (account notifications, system updates): legitimate interest — Art. 6(1)(f).",
          "Legal compliance (tax obligations, law enforcement requests, dispute resolution): legal obligation — Art. 6(1)(c).",
          "Analytics and platform improvement (optional, anonymized where possible): consent — Art. 6(1)(a).",
        ],
      },
      {
        title: "4. Data Sharing",
        paragraphs: [
          "We may share your data with the following categories of third-party processors, acting on our behalf and under contractual data processing agreements:",
        ],
        bullets: [
          "Hosting and infrastructure: cloud hosting providers (Supabase / AWS).",
          "Authentication: identity and access management services (Supabase Auth).",
          "Email delivery: transactional email providers (Resend).",
          "Analytics: optional analytics services (PostHog), with data collection routed through a first-party proxy endpoint at /ph on the Runoot domain.",
        ],
      },
      {
        title: "5. International Data Transfers",
        paragraphs: [
          "Some of our service providers may process data outside the European Economic Area (EEA). In such cases, we ensure that appropriate safeguards are in place, such as Standard Contractual Clauses (SCCs) approved by the European Commission, or transfers to countries that have received an adequacy decision.",
          "You may request information about specific transfer safeguards by contacting legal@runoot.com.",
        ],
      },
      {
        title: "6. Data Retention",
        paragraphs: [
          "We retain personal data only as long as necessary for the purposes described in this Policy. Specifically:",
        ],
        bullets: [
          "Account and profile data: retained for the duration of your account, plus up to 5 years after account deletion for legal and compliance purposes.",
          "Messages and communication data: retained for the duration of your account.",
          "Technical and security logs: retained for up to 12 months.",
          "Referral and invitation records: retained for the duration of the referring user's account.",
        ],
      },
      {
        title: "7. Your Rights",
        paragraphs: [
          "Under the GDPR, you have the following rights regarding your personal data:",
        ],
        bullets: [
          "Right of access: obtain confirmation of whether your data is being processed and request a copy.",
          "Right to rectification: request correction of inaccurate or incomplete data.",
          "Right to erasure (\"right to be forgotten\"): request deletion of your data, subject to legal retention obligations.",
          "Right to data portability: receive your data in a structured, commonly used, machine-readable format.",
          "Right to restriction: request limitation of processing in certain circumstances.",
          "Right to object: object to processing based on legitimate interest.",
          "Right to withdraw consent: where processing is based on consent, you may withdraw it at any time without affecting the lawfulness of processing carried out before withdrawal.",
        ],
      },
      {
        title: "8. How to Exercise Your Rights",
        paragraphs: [
          "To exercise any of these rights, send a request to legal@runoot.com. We will respond within 30 days, as required by the GDPR.",
          "You also have the right to lodge a complaint with the competent supervisory authority. For users in Italy, this is the Garante per la protezione dei dati personali (www.garanteprivacy.it).",
        ],
      },
      {
        title: "9. Children",
        paragraphs: [
          "Runoot is not directed at persons under 18 years of age. We do not knowingly collect personal data from minors. If we become aware that a user is under 18, we will take steps to delete their account and associated data.",
        ],
      },
      {
        title: "10. Changes to This Policy",
        paragraphs: [
          "We may update this Privacy Policy from time to time. Users will be notified of material changes via email or a notice on the platform. The date of the last update is indicated at the top of this document.",
        ],
      },
      {
        title: "11. Contact",
        paragraphs: [
          "For all privacy-related requests and questions: legal@runoot.com.",
        ],
      },
    ],
  },
  it: {
    title: "Privacy Policy",
    metaTitle: "Privacy Policy | Runoot",
    metaDescription: "Come Runoot raccoglie, utilizza e protegge i dati personali.",
    updatedAt: "8 aprile 2026",
    summary: "La presente Policy spiega come i dati personali vengono raccolti, utilizzati e protetti su Runoot, in conformita con il Regolamento (UE) 2016/679 (GDPR) e la normativa applicabile in materia di protezione dei dati.",
    sections: [
      {
        title: "1. Titolare del trattamento",
        paragraphs: [
          "Il titolare del trattamento e Runoot, con sede legale a Milano, Italia.",
          "Per tutte le questioni relative alla privacy, puoi contattarci all'indirizzo: legal@runoot.com.",
        ],
      },
      {
        title: "2. Dati raccolti",
        paragraphs: [
          "Possiamo raccogliere e trattare le seguenti categorie di dati personali:",
        ],
        bullets: [
          "Dati account: indirizzo email, password (hashata), nome completo, tipo utente (tour operator o privato).",
          "Dati profilo: nome azienda, numero di telefono, informazioni profilo.",
          "Dati annunci: descrizioni annunci, prezzi, disponibilita, dettagli evento.",
          "Dati comunicazioni: messaggi scambiati tra utenti sulla piattaforma.",
          "Dati tecnici: indirizzo IP, tipo di browser, informazioni dispositivo, log di accesso.",
          "Dati referral: registrazioni inviti, attribuzioni referral.",
        ],
      },
      {
        title: "3. Finalita e basi giuridiche",
        paragraphs: [
          "Trattiamo i tuoi dati personali per le seguenti finalita e sulle corrispondenti basi giuridiche ai sensi dell'Art. 6(1) GDPR:",
        ],
        bullets: [
          "Erogazione del servizio (creazione account, annunci, messaggistica): necessita contrattuale — Art. 6(1)(b).",
          "Sicurezza della piattaforma (prevenzione frodi, rilevamento abusi, log di accesso): legittimo interesse — Art. 6(1)(f).",
          "Comunicazioni di servizio (notifiche account, aggiornamenti di sistema): legittimo interesse — Art. 6(1)(f).",
          "Adempimenti legali (obblighi fiscali, richieste delle autorita, risoluzione controversie): obbligo legale — Art. 6(1)(c).",
          "Analisi e miglioramento della piattaforma (opzionale, anonimizzato ove possibile): consenso — Art. 6(1)(a).",
        ],
      },
      {
        title: "4. Condivisione dei dati",
        paragraphs: [
          "Possiamo condividere i tuoi dati con le seguenti categorie di responsabili del trattamento terzi, che agiscono per nostro conto e sulla base di accordi contrattuali per il trattamento dei dati:",
        ],
        bullets: [
          "Hosting e infrastruttura: fornitori di cloud hosting (Supabase / AWS).",
          "Autenticazione: servizi di gestione identita e accesso (Supabase Auth).",
          "Invio email: fornitori di email transazionali (Resend).",
          "Analytics: servizi di analisi opzionali (PostHog), con raccolta dati instradata tramite endpoint proxy first-party /ph sul dominio Runoot.",
        ],
      },
      {
        title: "5. Trasferimenti internazionali di dati",
        paragraphs: [
          "Alcuni dei nostri fornitori di servizi possono trattare dati al di fuori dello Spazio Economico Europeo (SEE). In tali casi, garantiamo che siano in atto adeguate garanzie, come le Clausole Contrattuali Standard (SCC) approvate dalla Commissione Europea, o trasferimenti verso paesi che hanno ricevuto una decisione di adeguatezza.",
          "Puoi richiedere informazioni sulle specifiche garanzie di trasferimento contattando legal@runoot.com.",
        ],
      },
      {
        title: "6. Conservazione dei dati",
        paragraphs: [
          "Conserviamo i dati personali solo per il tempo necessario alle finalita descritte nella presente Policy. In particolare:",
        ],
        bullets: [
          "Dati account e profilo: conservati per la durata dell'account, piu fino a 5 anni dalla cancellazione per finalita legali e di conformita.",
          "Messaggi e dati di comunicazione: conservati per la durata dell'account.",
          "Log tecnici e di sicurezza: conservati fino a 12 mesi.",
          "Dati referral e inviti: conservati per la durata dell'account dell'utente referente.",
        ],
      },
      {
        title: "7. I tuoi diritti",
        paragraphs: [
          "Ai sensi del GDPR, hai i seguenti diritti riguardo ai tuoi dati personali:",
        ],
        bullets: [
          "Diritto di accesso: ottenere conferma dell'esistenza di un trattamento e richiederne una copia.",
          "Diritto di rettifica: richiedere la correzione di dati inesatti o incompleti.",
          "Diritto alla cancellazione (\"diritto all'oblio\"): richiedere la cancellazione dei tuoi dati, nel rispetto degli obblighi legali di conservazione.",
          "Diritto alla portabilita: ricevere i tuoi dati in formato strutturato, di uso comune e leggibile da dispositivo automatico.",
          "Diritto di limitazione: richiedere la limitazione del trattamento in determinate circostanze.",
          "Diritto di opposizione: opporsi al trattamento basato sul legittimo interesse.",
          "Diritto di revoca del consenso: dove il trattamento e basato sul consenso, puoi revocarlo in qualsiasi momento senza pregiudicare la liceita del trattamento effettuato prima della revoca.",
        ],
      },
      {
        title: "8. Come esercitare i tuoi diritti",
        paragraphs: [
          "Per esercitare uno qualsiasi di questi diritti, invia una richiesta a legal@runoot.com. Risponderemo entro 30 giorni, come previsto dal GDPR.",
          "Hai inoltre il diritto di presentare un reclamo all'autorita di controllo competente. Per gli utenti in Italia, questa e il Garante per la protezione dei dati personali (www.garanteprivacy.it).",
        ],
      },
      {
        title: "9. Minori",
        paragraphs: [
          "Runoot non e rivolto a persone di eta inferiore ai 18 anni. Non raccogliamo consapevolmente dati personali di minori. Se veniamo a conoscenza che un utente ha meno di 18 anni, adotteremo misure per cancellare il suo account e i dati associati.",
        ],
      },
      {
        title: "10. Modifiche alla presente Policy",
        paragraphs: [
          "Potremmo aggiornare la presente Privacy Policy di tanto in tanto. Gli utenti saranno informati delle modifiche sostanziali tramite email o avviso sulla piattaforma. La data dell'ultimo aggiornamento e indicata in alto nel presente documento.",
        ],
      },
      {
        title: "11. Contatti",
        paragraphs: [
          "Per tutte le richieste e domande relative alla privacy: legal@runoot.com.",
        ],
      },
    ],
  },
  es: {
    title: "Politica de Privacidad",
    metaTitle: "Politica de Privacidad | Runoot",
    metaDescription: "Como Runoot recopila, usa y protege los datos personales.",
    updatedAt: "8 de abril de 2026",
    summary: "Esta Politica explica como se recopilan, utilizan y protegen los datos personales en Runoot, de conformidad con el Reglamento (UE) 2016/679 (RGPD) y la normativa aplicable en materia de proteccion de datos.",
    sections: [
      { title: "1. Responsable del tratamiento", paragraphs: ["El responsable del tratamiento es Runoot, con domicilio social en Milan, Italia.", "Para todas las cuestiones relacionadas con la privacidad, puede contactarnos en: legal@runoot.com."] },
      { title: "2. Datos que recopilamos", paragraphs: ["Podemos recopilar y tratar las siguientes categorias de datos personales:"], bullets: ["Datos de cuenta: direccion de correo, contrasena (hasheada), nombre completo, tipo de usuario (tour operator o particular).", "Datos de perfil: nombre de empresa, numero de telefono, informacion de perfil.", "Datos de anuncios: descripciones, precios, disponibilidad, detalles de eventos.", "Datos de comunicaciones: mensajes intercambiados entre usuarios en la plataforma.", "Datos tecnicos: direccion IP, tipo de navegador, informacion del dispositivo, registros de acceso.", "Datos de referidos: registros de invitaciones, atribuciones de referidos."] },
      { title: "3. Finalidades y bases legales", paragraphs: ["Tratamos tus datos personales para las siguientes finalidades y sobre las correspondientes bases legales conforme al Art. 6(1) RGPD:"], bullets: ["Prestacion del servicio (creacion de cuenta, anuncios, mensajeria): necesidad contractual — Art. 6(1)(b).", "Seguridad de la plataforma (prevencion de fraude, deteccion de abusos, registros de acceso): interes legitimo — Art. 6(1)(f).", "Comunicaciones del servicio (notificaciones de cuenta, actualizaciones del sistema): interes legitimo — Art. 6(1)(f).", "Cumplimiento legal (obligaciones fiscales, solicitudes de autoridades, resolucion de disputas): obligacion legal — Art. 6(1)(c).", "Analitica y mejora de la plataforma (opcional, anonimizada cuando sea posible): consentimiento — Art. 6(1)(a)."] },
      { title: "4. Comparticion de datos", paragraphs: ["Podemos compartir tus datos con las siguientes categorias de encargados del tratamiento terceros, actuando en nuestro nombre y bajo acuerdos contractuales de tratamiento de datos:"], bullets: ["Alojamiento e infraestructura: proveedores de hosting en la nube (Supabase / AWS).", "Autenticacion: servicios de gestion de identidad y acceso (Supabase Auth).", "Envio de correos: proveedores de email transaccional (Resend).", "Analitica: servicios de analisis opcionales (PostHog), con recopilacion de datos enrutada a traves de un endpoint proxy de primera parte en /ph en el dominio Runoot."] },
      { title: "5. Transferencias internacionales de datos", paragraphs: ["Algunos de nuestros proveedores de servicios pueden tratar datos fuera del Espacio Economico Europeo (EEE). En tales casos, garantizamos que existan garantias adecuadas, como las Clausulas Contractuales Tipo (CCT) aprobadas por la Comision Europea, o transferencias a paises que hayan recibido una decision de adecuacion.", "Puedes solicitar informacion sobre las garantias de transferencia especificas contactando a legal@runoot.com."] },
      { title: "6. Conservacion de datos", paragraphs: ["Conservamos los datos personales solo durante el tiempo necesario para las finalidades descritas en esta Politica. En concreto:"], bullets: ["Datos de cuenta y perfil: conservados durante la vigencia de la cuenta, mas hasta 5 anos tras la eliminacion por finalidades legales y de cumplimiento.", "Mensajes y datos de comunicacion: conservados durante la vigencia de la cuenta.", "Registros tecnicos y de seguridad: conservados hasta 12 meses.", "Datos de referidos e invitaciones: conservados durante la vigencia de la cuenta del usuario referente."] },
      { title: "7. Tus derechos", paragraphs: ["Conforme al RGPD, tienes los siguientes derechos respecto a tus datos personales:"], bullets: ["Derecho de acceso: obtener confirmacion de si tus datos estan siendo tratados y solicitar una copia.", "Derecho de rectificacion: solicitar la correccion de datos inexactos o incompletos.", "Derecho de supresion (\"derecho al olvido\"): solicitar la eliminacion de tus datos, sujeto a obligaciones legales de conservacion.", "Derecho a la portabilidad: recibir tus datos en formato estructurado, de uso comun y lectura mecanica.", "Derecho de limitacion: solicitar la limitacion del tratamiento en determinadas circunstancias.", "Derecho de oposicion: oponerse al tratamiento basado en interes legitimo.", "Derecho a retirar el consentimiento: cuando el tratamiento se base en el consentimiento, puedes retirarlo en cualquier momento sin afectar la licitud del tratamiento realizado antes de la retirada."] },
      { title: "8. Como ejercer tus derechos", paragraphs: ["Para ejercer cualquiera de estos derechos, envia una solicitud a legal@runoot.com. Responderemos en un plazo de 30 dias, conforme al RGPD.", "Tambien tienes derecho a presentar una reclamacion ante la autoridad de control competente. Para usuarios en Italia, es el Garante per la protezione dei dati personali (www.garanteprivacy.it)."] },
      { title: "9. Menores", paragraphs: ["Runoot no esta dirigido a personas menores de 18 anos. No recopilamos conscientemente datos personales de menores. Si tenemos conocimiento de que un usuario es menor de 18 anos, tomaremos medidas para eliminar su cuenta y datos asociados."] },
      { title: "10. Cambios en esta Politica", paragraphs: ["Podemos actualizar esta Politica de Privacidad de vez en cuando. Los usuarios seran notificados de cambios sustanciales por email o aviso en la plataforma. La fecha de la ultima actualizacion se indica al inicio de este documento."] },
      { title: "11. Contacto", paragraphs: ["Para todas las solicitudes y preguntas relacionadas con la privacidad: legal@runoot.com."] },
    ],
  },
  fr: {
    title: "Politique de confidentialite",
    metaTitle: "Politique de confidentialite | Runoot",
    metaDescription: "Comment Runoot collecte, utilise et protege les donnees personnelles.",
    updatedAt: "8 avril 2026",
    summary: "Cette politique explique comment les donnees personnelles sont collectees, utilisees et protegees sur Runoot, conformement au Reglement (UE) 2016/679 (RGPD) et a la legislation applicable en matiere de protection des donnees.",
    sections: [
      { title: "1. Responsable du traitement", paragraphs: ["Le responsable du traitement est Runoot, dont le siege social se trouve a Milan, Italie.", "Pour toute question relative a la confidentialite, vous pouvez nous contacter a : legal@runoot.com."] },
      { title: "2. Donnees collectees", paragraphs: ["Nous pouvons collecter et traiter les categories suivantes de donnees personnelles :"], bullets: ["Donnees de compte : adresse email, mot de passe (hache), nom complet, type d'utilisateur (tour operator ou particulier).", "Donnees de profil : nom de l'entreprise, numero de telephone, informations de profil.", "Donnees d'annonces : descriptions, prix, disponibilite, details d'evenements.", "Donnees de communication : messages echanges entre utilisateurs sur la plateforme.", "Donnees techniques : adresse IP, type de navigateur, informations sur l'appareil, journaux d'acces.", "Donnees de parrainage : enregistrements d'invitations, attributions de parrainage."] },
      { title: "3. Finalites et bases juridiques", paragraphs: ["Nous traitons vos donnees personnelles pour les finalites suivantes et sur les bases juridiques correspondantes au titre de l'Art. 6(1) RGPD :"], bullets: ["Fourniture du service (creation de compte, annonces, messagerie) : necessite contractuelle — Art. 6(1)(b).", "Securite de la plateforme (prevention de la fraude, detection des abus, journaux d'acces) : interet legitime — Art. 6(1)(f).", "Communications de service (notifications de compte, mises a jour systeme) : interet legitime — Art. 6(1)(f).", "Conformite legale (obligations fiscales, demandes des autorites, resolution de litiges) : obligation legale — Art. 6(1)(c).", "Analyse et amelioration de la plateforme (optionnel, anonymise si possible) : consentement — Art. 6(1)(a)."] },
      { title: "4. Partage des donnees", paragraphs: ["Nous pouvons partager vos donnees avec les categories suivantes de sous-traitants tiers, agissant pour notre compte et en vertu d'accords contractuels de traitement des donnees :"], bullets: ["Hebergement et infrastructure : fournisseurs d'hebergement cloud (Supabase / AWS).", "Authentification : services de gestion d'identite et d'acces (Supabase Auth).", "Envoi d'emails : fournisseurs d'emails transactionnels (Resend).", "Analyse : services d'analyse optionnels (PostHog), avec collecte de donnees acheminee via un endpoint proxy first-party /ph sur le domaine Runoot."] },
      { title: "5. Transferts internationaux de donnees", paragraphs: ["Certains de nos prestataires peuvent traiter des donnees en dehors de l'Espace economique europeen (EEE). Dans de tels cas, nous veillons a ce que des garanties appropriees soient en place, telles que les Clauses Contractuelles Types (CCT) approuvees par la Commission europeenne, ou des transferts vers des pays ayant fait l'objet d'une decision d'adequation.", "Vous pouvez demander des informations sur les garanties specifiques de transfert en contactant legal@runoot.com."] },
      { title: "6. Conservation des donnees", paragraphs: ["Nous conservons les donnees personnelles uniquement aussi longtemps que necessaire pour les finalites decrites dans cette politique. Plus precisement :"], bullets: ["Donnees de compte et de profil : conservees pendant la duree du compte, plus jusqu'a 5 ans apres la suppression pour des raisons legales et de conformite.", "Messages et donnees de communication : conserves pendant la duree du compte.", "Journaux techniques et de securite : conserves jusqu'a 12 mois.", "Donnees de parrainage et d'invitation : conservees pendant la duree du compte de l'utilisateur parrain."] },
      { title: "7. Vos droits", paragraphs: ["En vertu du RGPD, vous disposez des droits suivants concernant vos donnees personnelles :"], bullets: ["Droit d'acces : obtenir confirmation du traitement de vos donnees et en demander une copie.", "Droit de rectification : demander la correction de donnees inexactes ou incompletes.", "Droit a l'effacement (\"droit a l'oubli\") : demander la suppression de vos donnees, sous reserve des obligations legales de conservation.", "Droit a la portabilite : recevoir vos donnees dans un format structure, couramment utilise et lisible par machine.", "Droit a la limitation : demander la limitation du traitement dans certaines circonstances.", "Droit d'opposition : s'opposer au traitement fonde sur l'interet legitime.", "Droit de retrait du consentement : lorsque le traitement est fonde sur le consentement, vous pouvez le retirer a tout moment sans affecter la licite du traitement effectue avant le retrait."] },
      { title: "8. Comment exercer vos droits", paragraphs: ["Pour exercer l'un de ces droits, envoyez une demande a legal@runoot.com. Nous repondrons dans un delai de 30 jours, conformement au RGPD.", "Vous avez egalement le droit de deposer une plainte aupres de l'autorite de controle competente. Pour les utilisateurs en Italie, il s'agit du Garante per la protezione dei dati personali (www.garanteprivacy.it)."] },
      { title: "9. Mineurs", paragraphs: ["Runoot ne s'adresse pas aux personnes de moins de 18 ans. Nous ne collectons pas sciemment de donnees personnelles de mineurs. Si nous apprenons qu'un utilisateur a moins de 18 ans, nous prendrons des mesures pour supprimer son compte et les donnees associees."] },
      { title: "10. Modifications de cette politique", paragraphs: ["Nous pouvons mettre a jour cette politique de confidentialite de temps a autre. Les utilisateurs seront informes des modifications substantielles par email ou par un avis sur la plateforme. La date de la derniere mise a jour est indiquee en haut de ce document."] },
      { title: "11. Contact", paragraphs: ["Pour toute demande ou question relative a la confidentialite : legal@runoot.com."] },
    ],
  },
  de: {
    title: "Datenschutzrichtlinie",
    metaTitle: "Datenschutzrichtlinie | Runoot",
    metaDescription: "Wie Runoot personenbezogene Daten erhebt, nutzt und schuetzt.",
    updatedAt: "8. April 2026",
    summary: "Diese Richtlinie erlaeutert, wie personenbezogene Daten bei Runoot erhoben, verwendet und geschuetzt werden, in Uebereinstimmung mit der Verordnung (EU) 2016/679 (DSGVO) und dem anwendbaren Datenschutzrecht.",
    sections: [
      { title: "1. Verantwortlicher", paragraphs: ["Verantwortlicher fuer die Datenverarbeitung ist Runoot mit Sitz in Mailand, Italien.", "Fuer alle datenschutzbezogenen Angelegenheiten erreichen Sie uns unter: legal@runoot.com."] },
      { title: "2. Erhobene Daten", paragraphs: ["Wir koennen die folgenden Kategorien personenbezogener Daten erheben und verarbeiten:"], bullets: ["Kontodaten: E-Mail-Adresse, Passwort (gehasht), vollstaendiger Name, Nutzertyp (Tour Operator oder Privatperson).", "Profildaten: Firmenname, Telefonnummer, Profilinformationen.", "Anzeigendaten: Beschreibungen, Preise, Verfuegbarkeit, Veranstaltungsdetails.", "Kommunikationsdaten: Nachrichten zwischen Nutzern auf der Plattform.", "Technische Daten: IP-Adresse, Browsertyp, Geraeteinformationen, Zugriffsprotokolle.", "Empfehlungsdaten: Einladungsdatensaetze, Empfehlungszuordnungen."] },
      { title: "3. Zwecke und Rechtsgrundlagen", paragraphs: ["Wir verarbeiten Ihre personenbezogenen Daten zu folgenden Zwecken und auf den entsprechenden Rechtsgrundlagen gemaess Art. 6(1) DSGVO:"], bullets: ["Diensterbringung (Kontoerstellung, Anzeigen, Nachrichtenaustausch): Vertragserfuellung — Art. 6(1)(b).", "Plattformsicherheit (Betrugspraevention, Missbrauchserkennung, Zugriffsprotokolle): berechtigtes Interesse — Art. 6(1)(f).", "Service-Kommunikation (Kontobenachrichtigungen, Systemupdates): berechtigtes Interesse — Art. 6(1)(f).", "Rechtliche Einhaltung (Steuerpflichten, Behoerdenanfragen, Streitbeilegung): rechtliche Verpflichtung — Art. 6(1)(c).", "Analyse und Plattformverbesserung (optional, wenn moeglich anonymisiert): Einwilligung — Art. 6(1)(a)."] },
      { title: "4. Datenweitergabe", paragraphs: ["Wir koennen Ihre Daten mit folgenden Kategorien von Auftragsverarbeitern teilen, die in unserem Auftrag und auf der Grundlage vertraglicher Datenverarbeitungsvereinbarungen handeln:"], bullets: ["Hosting und Infrastruktur: Cloud-Hosting-Anbieter (Supabase / AWS).", "Authentifizierung: Identitaets- und Zugangsmanagementdienste (Supabase Auth).", "E-Mail-Versand: Transaktionale E-Mail-Anbieter (Resend).", "Analyse: optionale Analysedienste (PostHog), mit Datenerfassung ueber einen First-Party-Proxy-Endpunkt unter /ph auf der Runoot-Domain."] },
      { title: "5. Internationale Datenuebermittlungen", paragraphs: ["Einige unserer Dienstleister koennen Daten ausserhalb des Europaeischen Wirtschaftsraums (EWR) verarbeiten. In solchen Faellen stellen wir sicher, dass angemessene Garantien vorhanden sind, wie z.B. von der Europaeischen Kommission genehmigte Standardvertragsklauseln (SVK) oder Uebermittlungen in Laender mit Angemessenheitsbeschluss.", "Sie koennen Informationen ueber spezifische Uebermittlungsgarantien anfordern, indem Sie legal@runoot.com kontaktieren."] },
      { title: "6. Datenspeicherung", paragraphs: ["Wir speichern personenbezogene Daten nur so lange, wie es fuer die in dieser Richtlinie beschriebenen Zwecke erforderlich ist. Im Einzelnen:"], bullets: ["Konto- und Profildaten: gespeichert fuer die Dauer des Kontos, plus bis zu 5 Jahre nach Kontoloeschung fuer rechtliche und Compliance-Zwecke.", "Nachrichten und Kommunikationsdaten: gespeichert fuer die Dauer des Kontos.", "Technische und Sicherheitsprotokolle: gespeichert bis zu 12 Monate.", "Empfehlungs- und Einladungsdaten: gespeichert fuer die Dauer des Kontos des empfehlenden Nutzers."] },
      { title: "7. Ihre Rechte", paragraphs: ["Nach der DSGVO stehen Ihnen folgende Rechte bezueglich Ihrer personenbezogenen Daten zu:"], bullets: ["Auskunftsrecht: Bestaetigung erhalten, ob Ihre Daten verarbeitet werden, und eine Kopie anfordern.", "Recht auf Berichtigung: Korrektur ungenauer oder unvollstaendiger Daten verlangen.", "Recht auf Loeschung (\"Recht auf Vergessenwerden\"): Loeschung Ihrer Daten verlangen, vorbehaltlich gesetzlicher Aufbewahrungspflichten.", "Recht auf Datenuebertragbarkeit: Ihre Daten in einem strukturierten, gaengigen und maschinenlesbaren Format erhalten.", "Recht auf Einschraenkung: Einschraenkung der Verarbeitung unter bestimmten Umstaenden verlangen.", "Widerspruchsrecht: der Verarbeitung auf Basis berechtigter Interessen widersprechen.", "Recht auf Widerruf der Einwilligung: Wo die Verarbeitung auf Einwilligung basiert, koennen Sie diese jederzeit widerrufen, ohne die Rechtmaessigkeit der vor dem Widerruf erfolgten Verarbeitung zu beruehren."] },
      { title: "8. Ausuebung Ihrer Rechte", paragraphs: ["Um eines dieser Rechte auszuueben, senden Sie eine Anfrage an legal@runoot.com. Wir antworten innerhalb von 30 Tagen, wie von der DSGVO vorgeschrieben.", "Sie haben ausserdem das Recht, eine Beschwerde bei der zustaendigen Aufsichtsbehoerde einzureichen. Fuer Nutzer in Italien ist dies der Garante per la protezione dei dati personali (www.garanteprivacy.it)."] },
      { title: "9. Minderjaehrige", paragraphs: ["Runoot richtet sich nicht an Personen unter 18 Jahren. Wir erheben wissentlich keine personenbezogenen Daten von Minderjaehrigen. Wenn wir erfahren, dass ein Nutzer unter 18 Jahre alt ist, werden wir Massnahmen ergreifen, um das Konto und die zugehoerigen Daten zu loeschen."] },
      { title: "10. Aenderungen dieser Richtlinie", paragraphs: ["Wir koennen diese Datenschutzrichtlinie von Zeit zu Zeit aktualisieren. Nutzer werden ueber wesentliche Aenderungen per E-Mail oder durch einen Hinweis auf der Plattform informiert. Das Datum der letzten Aktualisierung ist oben in diesem Dokument angegeben."] },
      { title: "11. Kontakt", paragraphs: ["Fuer alle datenschutzbezogenen Anfragen und Fragen: legal@runoot.com."] },
    ],
  },
  nl: {
    title: "Privacybeleid",
    metaTitle: "Privacybeleid | Runoot",
    metaDescription: "Hoe Runoot persoonsgegevens verzamelt, gebruikt en beschermt.",
    updatedAt: "8 april 2026",
    summary: "Dit beleid legt uit hoe persoonsgegevens worden verzameld, gebruikt en beschermd op Runoot, in overeenstemming met Verordening (EU) 2016/679 (AVG) en de toepasselijke wetgeving inzake gegevensbescherming.",
    sections: [
      { title: "1. Verwerkingsverantwoordelijke", paragraphs: ["De verwerkingsverantwoordelijke is Runoot, gevestigd te Milaan, Italie.", "Voor alle privacygerelateerde zaken kunt u contact met ons opnemen via: legal@runoot.com."] },
      { title: "2. Gegevens die we verzamelen", paragraphs: ["We kunnen de volgende categorieen persoonsgegevens verzamelen en verwerken:"], bullets: ["Accountgegevens: e-mailadres, wachtwoord (gehasht), volledige naam, gebruikerstype (touroperator of particulier).", "Profielgegevens: bedrijfsnaam, telefoonnummer, profielinformatie.", "Advertentiegegevens: beschrijvingen, prijzen, beschikbaarheid, evenementdetails.", "Communicatiegegevens: berichten uitgewisseld tussen gebruikers op het platform.", "Technische gegevens: IP-adres, browsertype, apparaatinformatie, toegangslogs.", "Verwijzingsgegevens: uitnodigingsrecords, verwijzingstoewijzingen."] },
      { title: "3. Doeleinden en rechtsgronden", paragraphs: ["Wij verwerken uw persoonsgegevens voor de volgende doeleinden en op de overeenkomstige rechtsgronden op basis van Art. 6(1) AVG:"], bullets: ["Dienstverlening (accountaanmaak, advertenties, berichtenuitwisseling): contractuele noodzaak — Art. 6(1)(b).", "Platformbeveiliging (fraudepreventie, misbruikdetectie, toegangslogs): gerechtvaardigd belang — Art. 6(1)(f).", "Servicecommunicatie (accountmeldingen, systeemupdates): gerechtvaardigd belang — Art. 6(1)(f).", "Wettelijke naleving (belastingverplichtingen, verzoeken van autoriteiten, geschillenbeslechting): wettelijke verplichting — Art. 6(1)(c).", "Analyse en platformverbetering (optioneel, indien mogelijk geanonimiseerd): toestemming — Art. 6(1)(a)."] },
      { title: "4. Delen van gegevens", paragraphs: ["Wij kunnen uw gegevens delen met de volgende categorieen derde verwerkers, die namens ons handelen op basis van contractuele verwerkingsovereenkomsten:"], bullets: ["Hosting en infrastructuur: cloudhosting-aanbieders (Supabase / AWS).", "Authenticatie: identiteits- en toegangsbeheerdiensten (Supabase Auth).", "E-mailverzending: transactionele e-mailaanbieders (Resend).", "Analyse: optionele analysediensten (PostHog), met gegevensverzameling via een first-party proxy-endpoint op /ph op het Runoot-domein."] },
      { title: "5. Internationale gegevensoverdrachten", paragraphs: ["Sommige van onze dienstverleners kunnen gegevens verwerken buiten de Europese Economische Ruimte (EER). In dergelijke gevallen zorgen wij ervoor dat passende waarborgen zijn getroffen, zoals door de Europese Commissie goedgekeurde Standaardcontractbepalingen (SCC's) of overdrachten naar landen met een adequaatheidsbesluit.", "U kunt informatie opvragen over specifieke overdrachtwaarborgen door contact op te nemen met legal@runoot.com."] },
      { title: "6. Bewaartermijnen", paragraphs: ["Wij bewaren persoonsgegevens alleen zolang als nodig is voor de doeleinden beschreven in dit beleid. Specifiek:"], bullets: ["Account- en profielgegevens: bewaard gedurende de looptijd van het account, plus maximaal 5 jaar na verwijdering voor juridische en compliance-doeleinden.", "Berichten en communicatiegegevens: bewaard gedurende de looptijd van het account.", "Technische en beveiligingslogs: bewaard tot 12 maanden.", "Verwijzings- en uitnodigingsgegevens: bewaard gedurende de looptijd van het account van de verwijzende gebruiker."] },
      { title: "7. Uw rechten", paragraphs: ["Op grond van de AVG heeft u de volgende rechten met betrekking tot uw persoonsgegevens:"], bullets: ["Recht van inzage: bevestiging verkrijgen of uw gegevens worden verwerkt en een kopie opvragen.", "Recht op rectificatie: correctie van onjuiste of onvolledige gegevens verzoeken.", "Recht op wissing (\"recht om vergeten te worden\"): verwijdering van uw gegevens verzoeken, met inachtneming van wettelijke bewaarplichten.", "Recht op overdraagbaarheid: uw gegevens ontvangen in een gestructureerd, gangbaar en machineleesbaar formaat.", "Recht op beperking: beperking van de verwerking verzoeken onder bepaalde omstandigheden.", "Recht van bezwaar: bezwaar maken tegen verwerking op basis van gerechtvaardigd belang.", "Recht op intrekking van toestemming: wanneer de verwerking is gebaseerd op toestemming, kunt u deze te allen tijde intrekken zonder de rechtmatigheid van de verwerking voor de intrekking aan te tasten."] },
      { title: "8. Hoe u uw rechten uitoefent", paragraphs: ["Om een van deze rechten uit te oefenen, stuur een verzoek naar legal@runoot.com. Wij zullen binnen 30 dagen reageren, zoals vereist door de AVG.", "U heeft ook het recht om een klacht in te dienen bij de bevoegde toezichthoudende autoriteit. Voor gebruikers in Italie is dit de Garante per la protezione dei dati personali (www.garanteprivacy.it)."] },
      { title: "9. Minderjarigen", paragraphs: ["Runoot is niet gericht op personen jonger dan 18 jaar. Wij verzamelen niet bewust persoonsgegevens van minderjarigen. Als wij vernemen dat een gebruiker jonger is dan 18, zullen wij stappen ondernemen om het account en bijbehorende gegevens te verwijderen."] },
      { title: "10. Wijzigingen van dit beleid", paragraphs: ["Wij kunnen dit privacybeleid van tijd tot tijd bijwerken. Gebruikers worden via e-mail of een melding op het platform geinformeerd over wezenlijke wijzigingen. De datum van de laatste update staat bovenaan dit document vermeld."] },
      { title: "11. Contact", paragraphs: ["Voor alle privacygerelateerde verzoeken en vragen: legal@runoot.com."] },
    ],
  },
  pt: {
    title: "Politica de Privacidade",
    metaTitle: "Politica de Privacidade | Runoot",
    metaDescription: "Como a Runoot coleta, usa e protege dados pessoais.",
    updatedAt: "8 de abril de 2026",
    summary: "Esta Politica explica como dados pessoais sao coletados, utilizados e protegidos na Runoot, em conformidade com o Regulamento (UE) 2016/679 (RGPD) e a legislacao aplicavel de protecao de dados.",
    sections: [
      { title: "1. Controlador de dados", paragraphs: ["O controlador de dados e a Runoot, com sede em Milao, Italia.", "Para todas as questoes relacionadas a privacidade, voce pode nos contatar em: legal@runoot.com."] },
      { title: "2. Dados coletados", paragraphs: ["Podemos coletar e processar as seguintes categorias de dados pessoais:"], bullets: ["Dados da conta: endereco de e-mail, senha (em hash), nome completo, tipo de usuario (tour operator ou particular).", "Dados do perfil: nome da empresa, numero de telefone, informacoes do perfil.", "Dados de anuncios: descricoes, precos, disponibilidade, detalhes de eventos.", "Dados de comunicacao: mensagens trocadas entre usuarios na plataforma.", "Dados tecnicos: endereco IP, tipo de navegador, informacoes do dispositivo, registros de acesso.", "Dados de indicacao: registros de convites, atribuicoes de indicacao."] },
      { title: "3. Finalidades e bases legais", paragraphs: ["Processamos seus dados pessoais para as seguintes finalidades e com base nas correspondentes bases legais nos termos do Art. 6(1) RGPD:"], bullets: ["Prestacao do servico (criacao de conta, anuncios, mensagens): necessidade contratual — Art. 6(1)(b).", "Seguranca da plataforma (prevencao de fraude, deteccao de abuso, registros de acesso): interesse legitimo — Art. 6(1)(f).", "Comunicacoes do servico (notificacoes de conta, atualizacoes do sistema): interesse legitimo — Art. 6(1)(f).", "Conformidade legal (obrigacoes fiscais, solicitacoes de autoridades, resolucao de disputas): obrigacao legal — Art. 6(1)(c).", "Analise e melhoria da plataforma (opcional, anonimizado quando possivel): consentimento — Art. 6(1)(a)."] },
      { title: "4. Compartilhamento de dados", paragraphs: ["Podemos compartilhar seus dados com as seguintes categorias de processadores terceiros, atuando em nosso nome e com base em acordos contratuais de processamento de dados:"], bullets: ["Hospedagem e infraestrutura: provedores de hospedagem em nuvem (Supabase / AWS).", "Autenticacao: servicos de gestao de identidade e acesso (Supabase Auth).", "Envio de e-mails: provedores de e-mail transacional (Resend).", "Analise: servicos de analise opcionais (PostHog), com coleta de dados roteada atraves de um endpoint proxy de primeira parte em /ph no dominio Runoot."] },
      { title: "5. Transferencias internacionais de dados", paragraphs: ["Alguns de nossos provedores de servicos podem processar dados fora do Espaco Economico Europeu (EEE). Nesses casos, garantimos que salvaguardas adequadas estejam em vigor, como Clausulas Contratuais Padrao (CCPs) aprovadas pela Comissao Europeia, ou transferencias para paises que receberam uma decisao de adequacao.", "Voce pode solicitar informacoes sobre garantias de transferencia especificas contatando legal@runoot.com."] },
      { title: "6. Retencao de dados", paragraphs: ["Retemos dados pessoais apenas pelo tempo necessario para as finalidades descritas nesta Politica. Especificamente:"], bullets: ["Dados de conta e perfil: retidos durante a vigencia da conta, mais ate 5 anos apos a exclusao para fins legais e de conformidade.", "Mensagens e dados de comunicacao: retidos durante a vigencia da conta.", "Registros tecnicos e de seguranca: retidos por ate 12 meses.", "Dados de indicacao e convites: retidos durante a vigencia da conta do usuario indicante."] },
      { title: "7. Seus direitos", paragraphs: ["Nos termos do RGPD, voce tem os seguintes direitos em relacao aos seus dados pessoais:"], bullets: ["Direito de acesso: obter confirmacao se seus dados estao sendo processados e solicitar uma copia.", "Direito de retificacao: solicitar a correcao de dados imprecisos ou incompletos.", "Direito ao apagamento (\"direito ao esquecimento\"): solicitar a exclusao de seus dados, sujeito a obrigacoes legais de retencao.", "Direito a portabilidade: receber seus dados em formato estruturado, de uso comum e leitura mecanica.", "Direito a restricao: solicitar limitacao do processamento em certas circunstancias.", "Direito de oposicao: opor-se ao processamento baseado em interesse legitimo.", "Direito de retirar o consentimento: quando o processamento for baseado em consentimento, voce pode retira-lo a qualquer momento sem afetar a licitude do processamento realizado antes da retirada."] },
      { title: "8. Como exercer seus direitos", paragraphs: ["Para exercer qualquer um desses direitos, envie uma solicitacao para legal@runoot.com. Responderemos em 30 dias, conforme exigido pelo RGPD.", "Voce tambem tem o direito de apresentar uma reclamacao a autoridade supervisora competente. Para usuarios na Italia, esta e o Garante per la protezione dei dati personali (www.garanteprivacy.it)."] },
      { title: "9. Menores", paragraphs: ["A Runoot nao e dirigida a pessoas menores de 18 anos. Nao coletamos conscientemente dados pessoais de menores. Se tomarmos conhecimento de que um usuario tem menos de 18 anos, tomaremos medidas para excluir sua conta e dados associados."] },
      { title: "10. Alteracoes a esta Politica", paragraphs: ["Podemos atualizar esta Politica de Privacidade de tempos em tempos. Os usuarios serao notificados sobre alteracoes substanciais por e-mail ou aviso na plataforma. A data da ultima atualizacao esta indicada no topo deste documento."] },
      { title: "11. Contato", paragraphs: ["Para todas as solicitacoes e perguntas relacionadas a privacidade: legal@runoot.com."] },
    ],
  },
};

const COOKIES: Record<SupportedLocale, LegalPolicyDocument> = {
  en: {
    title: "Cookie Policy",
    metaTitle: "Cookie Policy | Runoot",
    metaDescription: "How Runoot uses cookies and similar technologies.",
    updatedAt: "April 8, 2026",
    summary: "This Policy explains what cookies are, which ones we use, and how you can manage them.",
    sections: [
      {
        title: "1. What Cookies Are",
        paragraphs: [
          "Cookies are small text files stored on your device by your web browser. They are used to support site functionality, remember your preferences, and improve your experience.",
        ],
      },
      {
        title: "2. Cookie Categories",
        paragraphs: [
          "Runoot uses the following categories of cookies:",
        ],
        bullets: [
          "Essential cookies: required for core platform functionality. These include authentication session cookies (sb-*), language preference (locale), and consent tracking (cookie_consent). These cannot be disabled as they are necessary for the platform to work.",
          "Analytics cookies (optional): used to understand how users interact with the platform and improve performance and user experience. Runoot uses PostHog for optional analytics; these cookies are only set with your explicit consent.",
        ],
      },
      {
        title: "3. Consent Management",
        paragraphs: [
          "When you first visit Runoot, a cookie banner will ask for your consent regarding optional cookies. You can accept or reject optional cookies at any time.",
          "Essential cookies remain active because they are strictly necessary for the platform to function. You cannot opt out of essential cookies while using the platform.",
          "You can also manage cookies through your browser settings. Most browsers allow you to block or delete cookies, although this may affect the functionality of the platform.",
        ],
      },
      {
        title: "4. Third-Party Cookies",
        paragraphs: [
          "Some cookies may be set by trusted third-party service providers used for authentication, hosting, or analytics.",
          "For optional analytics, Runoot uses PostHog. Analytics requests are routed through a first-party proxy endpoint at /ph on the Runoot domain to minimize third-party tracking.",
        ],
      },
      {
        title: "5. Cookie Duration",
        paragraphs: [
          "Session cookies are deleted when you close your browser. Persistent cookies remain on your device for a defined period or until you delete them manually.",
          "Authentication cookies (sb-*) persist for the duration of your login session. The consent cookie (cookie_consent) persists for 12 months.",
        ],
      },
      {
        title: "6. Contact",
        paragraphs: [
          "For questions about cookies, contact: legal@runoot.com.",
        ],
      },
    ],
  },
  it: {
    title: "Cookie Policy",
    metaTitle: "Cookie Policy | Runoot",
    metaDescription: "Come Runoot utilizza cookie e tecnologie simili.",
    updatedAt: "8 aprile 2026",
    summary: "Questa Policy spiega cosa sono i cookie, quali utilizziamo e come puoi gestirli.",
    sections: [
      { title: "1. Cosa sono i cookie", paragraphs: ["I cookie sono piccoli file di testo salvati sul tuo dispositivo dal browser web. Servono a supportare le funzionalita del sito, ricordare le tue preferenze e migliorare la tua esperienza."] },
      { title: "2. Categorie di cookie", paragraphs: ["Runoot utilizza le seguenti categorie di cookie:"], bullets: ["Cookie essenziali: necessari per il funzionamento base della piattaforma. Includono cookie di sessione di autenticazione (sb-*), preferenza lingua (locale) e tracciamento consenso (cookie_consent). Non possono essere disattivati in quanto necessari al funzionamento della piattaforma.", "Cookie analitici (opzionali): utilizzati per comprendere come gli utenti interagiscono con la piattaforma e migliorare prestazioni ed esperienza utente. Runoot usa PostHog per analytics opzionali; questi cookie vengono impostati solo con il tuo consenso esplicito."] },
      { title: "3. Gestione del consenso", paragraphs: ["Alla prima visita su Runoot, un banner cookie ti chiedera il consenso riguardo ai cookie opzionali. Puoi accettare o rifiutare i cookie opzionali in qualsiasi momento.", "I cookie essenziali restano attivi perche strettamente necessari al funzionamento della piattaforma. Non puoi disattivarli durante l'uso della piattaforma.", "Puoi inoltre gestire i cookie tramite le impostazioni del tuo browser. La maggior parte dei browser consente di bloccare o eliminare i cookie, anche se cio potrebbe influire sulla funzionalita della piattaforma."] },
      { title: "4. Cookie di terze parti", paragraphs: ["Alcuni cookie possono essere impostati da fornitori terzi di fiducia utilizzati per autenticazione, hosting o analytics.", "Per gli analytics opzionali, Runoot usa PostHog. Le richieste di analytics sono instradate tramite un endpoint proxy first-party /ph sul dominio Runoot per minimizzare il tracciamento di terze parti."] },
      { title: "5. Durata dei cookie", paragraphs: ["I cookie di sessione vengono eliminati alla chiusura del browser. I cookie persistenti rimangono sul tuo dispositivo per un periodo definito o fino alla cancellazione manuale.", "I cookie di autenticazione (sb-*) persistono per la durata della sessione di login. Il cookie di consenso (cookie_consent) persiste per 12 mesi."] },
      { title: "6. Contatti", paragraphs: ["Per domande sui cookie, contattare: legal@runoot.com."] },
    ],
  },
  es: {
    title: "Politica de Cookies",
    metaTitle: "Politica de Cookies | Runoot",
    metaDescription: "Como Runoot usa cookies y tecnologias similares.",
    updatedAt: "8 de abril de 2026",
    summary: "Esta Politica explica que son las cookies, cuales utilizamos y como puedes gestionarlas.",
    sections: [
      { title: "1. Que son las cookies", paragraphs: ["Las cookies son pequenos archivos de texto almacenados en tu dispositivo por el navegador web. Se utilizan para apoyar la funcionalidad del sitio, recordar tus preferencias y mejorar tu experiencia."] },
      { title: "2. Categorias de cookies", paragraphs: ["Runoot utiliza las siguientes categorias de cookies:"], bullets: ["Cookies esenciales: necesarias para la funcionalidad basica de la plataforma. Incluyen cookies de sesion de autenticacion (sb-*), preferencia de idioma (locale) y seguimiento del consentimiento (cookie_consent). No pueden desactivarse ya que son necesarias para el funcionamiento de la plataforma.", "Cookies de analisis (opcionales): utilizadas para entender como los usuarios interactuan con la plataforma y mejorar el rendimiento y la experiencia de usuario. Runoot usa PostHog para analitica opcional; estas cookies solo se configuran con tu consentimiento explicito."] },
      { title: "3. Gestion del consentimiento", paragraphs: ["Al visitar Runoot por primera vez, un banner de cookies solicitara tu consentimiento respecto a las cookies opcionales. Puedes aceptar o rechazar las cookies opcionales en cualquier momento.", "Las cookies esenciales permanecen activas porque son estrictamente necesarias para el funcionamiento de la plataforma. No puedes desactivarlas mientras usas la plataforma.", "Tambien puedes gestionar las cookies a traves de la configuracion de tu navegador. La mayoria de los navegadores permiten bloquear o eliminar cookies, aunque esto puede afectar la funcionalidad de la plataforma."] },
      { title: "4. Cookies de terceros", paragraphs: ["Algunas cookies pueden ser configuradas por proveedores de servicios terceros de confianza utilizados para autenticacion, alojamiento o analitica.", "Para analitica opcional, Runoot usa PostHog. Las solicitudes de analitica se enrutan a traves de un endpoint proxy de primera parte en /ph en el dominio Runoot para minimizar el rastreo de terceros."] },
      { title: "5. Duracion de las cookies", paragraphs: ["Las cookies de sesion se eliminan al cerrar el navegador. Las cookies persistentes permanecen en tu dispositivo durante un periodo definido o hasta que las elimines manualmente.", "Las cookies de autenticacion (sb-*) persisten durante la sesion de inicio de sesion. La cookie de consentimiento (cookie_consent) persiste durante 12 meses."] },
      { title: "6. Contacto", paragraphs: ["Para consultas sobre cookies, contactar: legal@runoot.com."] },
    ],
  },
  fr: {
    title: "Politique relative aux cookies",
    metaTitle: "Politique relative aux cookies | Runoot",
    metaDescription: "Comment Runoot utilise les cookies et technologies similaires.",
    updatedAt: "8 avril 2026",
    summary: "Cette politique explique ce que sont les cookies, lesquels nous utilisons et comment vous pouvez les gerer.",
    sections: [
      { title: "1. Definition des cookies", paragraphs: ["Les cookies sont de petits fichiers texte stockes sur votre appareil par votre navigateur web. Ils sont utilises pour assurer le fonctionnement du site, retenir vos preferences et ameliorer votre experience."] },
      { title: "2. Categories de cookies", paragraphs: ["Runoot utilise les categories de cookies suivantes :"], bullets: ["Cookies essentiels : necessaires au fonctionnement de base de la plateforme. Ils incluent les cookies de session d'authentification (sb-*), la preference de langue (locale) et le suivi du consentement (cookie_consent). Ils ne peuvent pas etre desactives car ils sont necessaires au fonctionnement de la plateforme.", "Cookies d'analyse (optionnels) : utilises pour comprendre comment les utilisateurs interagissent avec la plateforme et ameliorer les performances et l'experience utilisateur. Runoot utilise PostHog pour l'analyse optionnelle ; ces cookies ne sont places qu'avec votre consentement explicite."] },
      { title: "3. Gestion du consentement", paragraphs: ["Lors de votre premiere visite sur Runoot, un bandeau cookies sollicitera votre consentement concernant les cookies optionnels. Vous pouvez accepter ou refuser les cookies optionnels a tout moment.", "Les cookies essentiels restent actifs car ils sont strictement necessaires au fonctionnement de la plateforme. Vous ne pouvez pas les desactiver pendant l'utilisation de la plateforme.", "Vous pouvez egalement gerer les cookies via les parametres de votre navigateur. La plupart des navigateurs permettent de bloquer ou supprimer les cookies, bien que cela puisse affecter la fonctionnalite de la plateforme."] },
      { title: "4. Cookies tiers", paragraphs: ["Certains cookies peuvent etre places par des prestataires tiers de confiance utilises pour l'authentification, l'hebergement ou l'analyse.", "Pour l'analyse optionnelle, Runoot utilise PostHog. Les requetes d'analyse sont acheminees via un endpoint proxy first-party /ph sur le domaine Runoot pour minimiser le pistage tiers."] },
      { title: "5. Duree des cookies", paragraphs: ["Les cookies de session sont supprimes a la fermeture du navigateur. Les cookies persistants restent sur votre appareil pendant une duree definie ou jusqu'a ce que vous les supprimiez manuellement.", "Les cookies d'authentification (sb-*) persistent pendant la duree de votre session de connexion. Le cookie de consentement (cookie_consent) persiste pendant 12 mois."] },
      { title: "6. Contact", paragraphs: ["Pour les questions relatives aux cookies, contacter : legal@runoot.com."] },
    ],
  },
  de: {
    title: "Cookie-Richtlinie",
    metaTitle: "Cookie-Richtlinie | Runoot",
    metaDescription: "Wie Runoot Cookies und aehnliche Technologien verwendet.",
    updatedAt: "8. April 2026",
    summary: "Diese Richtlinie erklaert, was Cookies sind, welche wir verwenden und wie Sie diese verwalten koennen.",
    sections: [
      { title: "1. Was Cookies sind", paragraphs: ["Cookies sind kleine Textdateien, die von Ihrem Webbrowser auf Ihrem Geraet gespeichert werden. Sie dienen dazu, die Funktionalitaet der Website zu unterstuetzen, Ihre Einstellungen zu speichern und Ihre Erfahrung zu verbessern."] },
      { title: "2. Cookie-Kategorien", paragraphs: ["Runoot verwendet die folgenden Cookie-Kategorien:"], bullets: ["Essenzielle Cookies: erforderlich fuer die grundlegende Plattformfunktionalitaet. Dazu gehoeren Authentifizierungs-Sitzungscookies (sb-*), Spracheinstellung (locale) und Einwilligungsverfolgung (cookie_consent). Diese koennen nicht deaktiviert werden, da sie fuer den Betrieb der Plattform notwendig sind.", "Analyse-Cookies (optional): dienen dem Verstaendnis der Nutzerinteraktion mit der Plattform und der Verbesserung von Leistung und Nutzererlebnis. Runoot verwendet PostHog fuer optionale Analysen; diese Cookies werden nur mit Ihrer ausdruecklichen Einwilligung gesetzt."] },
      { title: "3. Einwilligungsverwaltung", paragraphs: ["Bei Ihrem ersten Besuch auf Runoot werden Sie ueber ein Cookie-Banner um Ihre Einwilligung zu optionalen Cookies gebeten. Sie koennen optionale Cookies jederzeit akzeptieren oder ablehnen.", "Essenzielle Cookies bleiben aktiv, da sie fuer den Betrieb der Plattform streng notwendig sind. Sie koennen sie waehrend der Nutzung der Plattform nicht deaktivieren.", "Sie koennen Cookies auch ueber Ihre Browsereinstellungen verwalten. Die meisten Browser ermoeglichen das Blockieren oder Loeschen von Cookies, wobei dies die Funktionalitaet der Plattform beeintraechtigen kann."] },
      { title: "4. Drittanbieter-Cookies", paragraphs: ["Einige Cookies koennen von vertrauenswuerdigen Drittanbietern fuer Authentifizierung, Hosting oder Analyse gesetzt werden.", "Fuer optionale Analysen verwendet Runoot PostHog. Analyse-Anfragen werden ueber einen First-Party-Proxy-Endpunkt unter /ph auf der Runoot-Domain geleitet, um Drittanbieter-Tracking zu minimieren."] },
      { title: "5. Cookie-Dauer", paragraphs: ["Sitzungscookies werden beim Schliessen des Browsers geloescht. Persistente Cookies verbleiben auf Ihrem Geraet fuer einen definierten Zeitraum oder bis Sie sie manuell loeschen.", "Authentifizierungscookies (sb-*) bestehen fuer die Dauer Ihrer Anmeldesitzung. Das Einwilligungscookie (cookie_consent) besteht fuer 12 Monate."] },
      { title: "6. Kontakt", paragraphs: ["Fuer Fragen zu Cookies: legal@runoot.com."] },
    ],
  },
  nl: {
    title: "Cookiebeleid",
    metaTitle: "Cookiebeleid | Runoot",
    metaDescription: "Hoe Runoot cookies en vergelijkbare technologieen gebruikt.",
    updatedAt: "8 april 2026",
    summary: "Dit beleid legt uit wat cookies zijn, welke we gebruiken en hoe u ze kunt beheren.",
    sections: [
      { title: "1. Wat cookies zijn", paragraphs: ["Cookies zijn kleine tekstbestanden die door uw webbrowser op uw apparaat worden opgeslagen. Ze worden gebruikt om websitefunctionaliteit te ondersteunen, uw voorkeuren te onthouden en uw ervaring te verbeteren."] },
      { title: "2. Cookiecategorieen", paragraphs: ["Runoot gebruikt de volgende categorieen cookies:"], bullets: ["Essentiele cookies: vereist voor de basisfunctionaliteit van het platform. Deze omvatten authenticatie-sessiecookies (sb-*), taalvoorkeur (locale) en toestemmingstracking (cookie_consent). Deze kunnen niet worden uitgeschakeld omdat ze nodig zijn voor de werking van het platform.", "Analytics-cookies (optioneel): gebruikt om te begrijpen hoe gebruikers met het platform omgaan en om prestaties en gebruikerservaring te verbeteren. Runoot gebruikt PostHog voor optionele analyse; deze cookies worden alleen geplaatst met uw uitdrukkelijke toestemming."] },
      { title: "3. Toestemmingsbeheer", paragraphs: ["Bij uw eerste bezoek aan Runoot vraagt een cookiebanner om uw toestemming voor optionele cookies. U kunt optionele cookies op elk moment accepteren of weigeren.", "Essentiele cookies blijven actief omdat ze strikt noodzakelijk zijn voor de werking van het platform. U kunt ze niet uitschakelen tijdens het gebruik van het platform.", "U kunt cookies ook beheren via uw browserinstellingen. De meeste browsers staan het blokkeren of verwijderen van cookies toe, hoewel dit de functionaliteit van het platform kan beinvloeden."] },
      { title: "4. Cookies van derden", paragraphs: ["Sommige cookies kunnen worden geplaatst door vertrouwde externe dienstverleners die worden gebruikt voor authenticatie, hosting of analyse.", "Voor optionele analyse gebruikt Runoot PostHog. Analyseverzoeken worden geleid via een first-party proxy-endpoint op /ph op het Runoot-domein om tracking door derden te minimaliseren."] },
      { title: "5. Cookieduur", paragraphs: ["Sessiecookies worden verwijderd wanneer u uw browser sluit. Persistente cookies blijven op uw apparaat voor een bepaalde periode of totdat u ze handmatig verwijdert.", "Authenticatiecookies (sb-*) blijven bestaan voor de duur van uw inlogsessie. De toestemmingscookie (cookie_consent) blijft 12 maanden bestaan."] },
      { title: "6. Contact", paragraphs: ["Voor vragen over cookies: legal@runoot.com."] },
    ],
  },
  pt: {
    title: "Politica de Cookies",
    metaTitle: "Politica de Cookies | Runoot",
    metaDescription: "Como a Runoot usa cookies e tecnologias semelhantes.",
    updatedAt: "8 de abril de 2026",
    summary: "Esta politica explica o que sao cookies, quais utilizamos e como voce pode gerencia-los.",
    sections: [
      { title: "1. O que sao cookies", paragraphs: ["Cookies sao pequenos arquivos de texto armazenados em seu dispositivo pelo navegador web. Sao utilizados para suportar a funcionalidade do site, lembrar suas preferencias e melhorar sua experiencia."] },
      { title: "2. Categorias de cookies", paragraphs: ["A Runoot utiliza as seguintes categorias de cookies:"], bullets: ["Cookies essenciais: necessarios para a funcionalidade basica da plataforma. Incluem cookies de sessao de autenticacao (sb-*), preferencia de idioma (locale) e rastreamento de consentimento (cookie_consent). Nao podem ser desativados pois sao necessarios para o funcionamento da plataforma.", "Cookies de analise (opcionais): utilizados para entender como os usuarios interagem com a plataforma e melhorar o desempenho e a experiencia do usuario. A Runoot usa o PostHog para analises opcionais; esses cookies so sao definidos com seu consentimento explicito."] },
      { title: "3. Gestao de consentimento", paragraphs: ["Em sua primeira visita a Runoot, um banner de cookies solicitara seu consentimento em relacao aos cookies opcionais. Voce pode aceitar ou recusar cookies opcionais a qualquer momento.", "Os cookies essenciais permanecem ativos porque sao estritamente necessarios para o funcionamento da plataforma. Voce nao pode desativa-los durante o uso da plataforma.", "Voce tambem pode gerenciar cookies atraves das configuracoes do seu navegador. A maioria dos navegadores permite bloquear ou excluir cookies, embora isso possa afetar a funcionalidade da plataforma."] },
      { title: "4. Cookies de terceiros", paragraphs: ["Alguns cookies podem ser definidos por provedores de servicos terceiros confiaveis utilizados para autenticacao, hospedagem ou analise.", "Para analise opcional, a Runoot usa o PostHog. As solicitacoes de analise sao roteadas atraves de um endpoint proxy de primeira parte em /ph no dominio Runoot para minimizar o rastreamento de terceiros."] },
      { title: "5. Duracao dos cookies", paragraphs: ["Cookies de sessao sao excluidos ao fechar o navegador. Cookies persistentes permanecem em seu dispositivo por um periodo definido ou ate voce exclui-los manualmente.", "Os cookies de autenticacao (sb-*) persistem durante a sessao de login. O cookie de consentimento (cookie_consent) persiste por 12 meses."] },
      { title: "6. Contato", paragraphs: ["Para duvidas sobre cookies, contatar: legal@runoot.com."] },
    ],
  },
};

export function getLegalPolicyDocument(type: LegalPolicyType, locale: SupportedLocale): LegalPolicyDocument {
  if (type === "terms") return TERMS[locale];
  if (type === "privacy") return PRIVACY[locale];
  return COOKIES[locale];
}
