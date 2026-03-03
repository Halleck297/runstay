import type { SupportedLocale } from "~/lib/locale";
import { useI18n } from "~/hooks/useI18n";

export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export type LegalDocument = {
  title: string;
  subtitle: string;
  sections: LegalSection[];
};

export type LegalDocumentKey = "legal-notes" | "mentions-legales" | "impressum" | "aviso-legal";

const LEGAL_LAST_UPDATED = "27 February 2026";

const LEGAL_NOTES_BY_LOCALE: Partial<Record<SupportedLocale, LegalDocument>> = {
  en: {
    title: "Legal Notes",
    subtitle: "Legal notice and publisher information for runoot.com",
    sections: [
      {
        title: "1. Publisher Information",
        paragraphs: [
          "Website: runoot.com",
          "Operator (natural person): Jonathan Mazzantini",
          "Registered address: Via Bercilli,29 Cerreto Guidi (FI),Italy",
          "Email: legal@runoot.com",
          "Legal form: private individual (not a company).",
          "VAT ID: not applicable.",
          "Supervisory authority: no requiring activity is carried out.",
        ],
      },
      {
        title: "2. Hosting Provider",
        paragraphs: [
          "The platform is hosted by Vercel Inc., with infrastructure distributed across multiple regions.",
          "Additional backend services are provided by Supabase Inc.",
        ],
      },
      {
        title: "3. Liability Disclaimer",
        paragraphs: [
          "Runoot is an online listing platform and does not act as a party to user transactions.",
          "Users remain solely responsible for the accuracy, legality, and execution of their listings and agreements.",
        ],
      },
      {
        title: "4. Intellectual Property",
        paragraphs: [
          "All trademarks, logos, and platform content are protected by applicable intellectual property laws.",
          "Unauthorized reproduction or redistribution is prohibited without prior written permission.",
        ],
      },
    ],
  },
  it: {
    title: "Note Legali",
    subtitle: "Informazioni legali e dati del gestore del sito Runoot.",
    sections: [
      {
        title: "1. Dati del gestore",
        paragraphs: [
          "Sito web: runoot.com",
          "Gestore (persona fisica): Jonathan Mazzantini.",
          "Sede legale: Via Bercilli,29 Cerreto Guidi (FI),Italy",
          "Email: legal@runoot.com",
          "Forma giuridica: privato cittadino (non societa).",
          "Partita IVA: non applicabile.",
          "Autorita di vigilanza: nessuna, salvo attivita soggette ad autorizzazione.",
        ],
      },
      {
        title: "2. Hosting",
        paragraphs: [
          "La piattaforma e ospitata da Vercel Inc., con infrastruttura distribuita su piu regioni.",
          "Servizi backend aggiuntivi sono forniti da Supabase Inc.",
        ],
      },
      {
        title: "3. Limitazione di responsabilita",
        paragraphs: [
          "Runoot e una piattaforma di annunci online e non e parte delle transazioni tra utenti.",
          "Gli utenti restano gli unici responsabili per accuratezza, legalita ed esecuzione dei propri annunci e accordi.",
        ],
      },
      {
        title: "4. Proprieta intellettuale",
        paragraphs: [
          "Marchi, loghi e contenuti della piattaforma sono protetti dalla normativa applicabile.",
          "Riproduzione o redistribuzione senza autorizzazione scritta preventiva non sono consentite.",
        ],
      },
    ],
  },
  nl: {
    title: "Juridische Notities",
    subtitle: "Juridische kennisgeving en informatie over de exploitant van Runoot.",
    sections: [
      {
        title: "1. Gegevens van de exploitant",
        paragraphs: [
          "Website: runoot.com",
          "Exploitant (natuurlijke persoon): Jonathan Mazzantini",
          "Geregistreerd adres: Via Bercilli,29 Cerreto Guidi (FI),Italy",
          "E-mail: legal@runoot.com",
          "Rechtsvorm: particulier (geen onderneming).",
          "Btw-nummer: niet van toepassing.",
          "Toezichthoudende autoriteit: geen, tenzij een vergunningplichtige activiteit wordt uitgevoerd.",
        ],
      },
      {
        title: "2. Hosting",
        paragraphs: [
          "Het platform wordt gehost door Vercel Inc., met infrastructuur verspreid over meerdere regio's.",
          "Aanvullende backenddiensten worden geleverd door Supabase Inc.",
        ],
      },
      {
        title: "3. Aansprakelijkheidsverklaring",
        paragraphs: [
          "Runoot is een online advertentieplatform en is geen partij bij transacties tussen gebruikers.",
          "Gebruikers blijven als enige verantwoordelijk voor juistheid, rechtmatigheid en uitvoering van hun advertenties en afspraken.",
        ],
      },
      {
        title: "4. Intellectueel eigendom",
        paragraphs: [
          "Alle merken, logo's en inhoud van het platform zijn beschermd door toepasselijke wetgeving.",
          "Reproductie of herverdeling zonder voorafgaande schriftelijke toestemming is verboden.",
        ],
      },
    ],
  },
  pt: {
    title: "Notas Legais",
    subtitle: "Aviso legal e informacoes sobre o operador da Runoot.",
    sections: [
      {
        title: "1. Informacoes do operador",
        paragraphs: [
          "Site: runoot.com",
          "Operador (pessoa fisica): Jonathan Mazzantini",
          "Endereco registado: Via Bercilli,29 Cerreto Guidi (FI),Italy",
          "Email: legal@runoot.com",
          "Forma juridica: pessoa fisica (nao empresa).",
          "NIF/VAT: nao aplicavel.",
          "Autoridade supervisora: nenhuma, salvo atividade sujeita a autorizacao.",
        ],
      },
      {
        title: "2. Hospedagem",
        paragraphs: [
          "A plataforma e hospedada pela Vercel Inc., com infraestrutura distribuida por varias regioes.",
          "Servicos backend adicionais sao fornecidos pela Supabase Inc.",
        ],
      },
      {
        title: "3. Isencao de responsabilidade",
        paragraphs: [
          "A Runoot e uma plataforma de anuncios online e nao atua como parte nas transacoes entre utilizadores.",
          "Os utilizadores sao os unicos responsaveis pela exatidao, legalidade e execucao dos seus anuncios e acordos.",
        ],
      },
      {
        title: "4. Propriedade intelectual",
        paragraphs: [
          "Todas as marcas, logotipos e conteudos da plataforma estao protegidos pela legislacao aplicavel.",
          "A reproducao ou redistribuicao sem autorizacao previa por escrito e proibida.",
        ],
      },
    ],
  },
};

const FIXED_DOCS: Record<Exclude<LegalDocumentKey, "legal-notes">, LegalDocument> = {
  "mentions-legales": {
    title: "Mentions Legales",
    subtitle: "Informations legales relatives a l'editeur du site Runoot.",
    sections: [
      {
        title: "1. Editeur du site",
        paragraphs: [
          "Site: runoot.com",
          "Editeur (personne physique): Jonathan Mazzantini",
          "Adresse du siege: Via Bercilli,29 Cerreto Guidi (FI),Italy",
          "Contact: legal@runoot.com",
          "Forme juridique: particulier (pas une societe).",
          "Numero TVA: non applicable.",
          "Autorite de controle: aucune, sauf activite soumise a autorisation.",
        ],
      },
      {
        title: "2. Hebergement",
        paragraphs: [
          "Le site est heberge par Vercel Inc., avec une infrastructure repartie sur plusieurs regions.",
          "Des services techniques complementaires sont fournis par Supabase Inc.",
        ],
      },
      {
        title: "3. Responsabilite",
        paragraphs: [
          "Runoot agit comme plateforme d'annonces et n'intervient pas comme partie aux transactions entre utilisateurs.",
          "Chaque utilisateur est responsable des informations publiees et des accords conclus avec d'autres utilisateurs.",
        ],
      },
      {
        title: "4. Propriete intellectuelle",
        paragraphs: [
          "Les contenus, marques et elements graphiques du site sont proteges par les lois en vigueur.",
          "Toute reproduction sans autorisation ecrite prealable est interdite.",
        ],
      },
    ],
  },
  impressum: {
    title: "Impressum",
    subtitle: "Anbieterkennzeichnung fur eine privat betriebene Plattform.",
    sections: [
      {
        title: "1. Angaben gemaB 5 DDG",
        paragraphs: [
          "Website: runoot.com",
          "Betreiber (naturliche Person): Jonathan Mazzantini",
          "Ladungsfahige Anschrift: Via Bercilli,29 Cerreto Guidi (FI),Italy",
          "Kontakt-E-Mail: legal@runoot.com",
          "Rechtsform: Privatperson (kein Unternehmen).",
          "USt-IdNr.: nicht anwendbar.",
          "Aufsichtsbehorde: keine, sofern keine erlaubnispflichtige Tatigkeit ausgeubt wird.",
        ],
      },
      {
        title: "2. Hosting und technische Dienstleister",
        paragraphs: [
          "Die Plattform wird bei Vercel Inc. gehostet, mit Infrastruktur in mehreren Regionen.",
          "Zusatzliche Backend-Dienste werden durch Supabase Inc. bereitgestellt.",
        ],
      },
      {
        title: "3. Haftung fur Inhalte",
        paragraphs: [
          "Runoot ist eine Anzeigenplattform und nicht Vertragspartei bei Transaktionen zwischen Nutzern.",
          "Fur Inhalte von Inseraten und die Durchfuhrung von Vereinbarungen sind ausschlieBlich die jeweiligen Nutzer verantwortlich.",
        ],
      },
      {
        title: "4. Urheberrecht",
        paragraphs: [
          "Inhalte, Marken und Design-Elemente der Plattform unterliegen dem Urheber- und Kennzeichenrecht.",
          "Eine Nutzung auBerhalb der gesetzlichen Schranken ist nur mit vorheriger schriftlicher Zustimmung zulassig.",
        ],
      },
    ],
  },
  "aviso-legal": {
    title: "Aviso Legal",
    subtitle: "Informacion legal y titularidad del sitio Runoot.",
    sections: [
      {
        title: "1. Titular del sitio web",
        paragraphs: [
          "Sitio web: runoot.com",
          "Titular (persona fisica): Jonathan Mazzantini",
          "Domicilio social: Via Bercilli,29 Cerreto Guidi (FI),Italy",
          "Correo de contacto: legal@runoot.com",
          "Forma juridica: persona particular (no empresa).",
          "NIF-IVA:  no aplicable.",
          "Autoridad supervisora: ninguna, salvo actividad sujeta a autorizacion.",
        ],
      },
      {
        title: "2. Alojamiento",
        paragraphs: [
          "La plataforma esta alojada en Vercel Inc., con infraestructura distribuida en varias regiones.",
          "Servicios tecnicos adicionales son provistos por Supabase Inc.",
        ],
      },
      {
        title: "3. Responsabilidad",
        paragraphs: [
          "Runoot opera como plataforma de anuncios y no interviene como parte en las transacciones entre usuarios.",
          "Cada usuario es responsable de la informacion publicada y de los acuerdos celebrados con terceros.",
        ],
      },
      {
        title: "4. Propiedad intelectual",
        paragraphs: [
          "Las marcas, logotipos y contenidos del sitio estan protegidos por la normativa aplicable.",
          "Queda prohibida su reproduccion o distribucion sin autorizacion previa y por escrito.",
        ],
      },
    ],
  },
};

function getLegalNotesForLocale(locale: SupportedLocale): LegalDocument {
  return LEGAL_NOTES_BY_LOCALE[locale] || LEGAL_NOTES_BY_LOCALE.en!;
}

export function resolveLegalDocumentForLocale(locale: SupportedLocale): {
  key: LegalDocumentKey;
  document: LegalDocument;
} {
  if (locale === "fr") {
    return { key: "mentions-legales", document: FIXED_DOCS["mentions-legales"] };
  }
  if (locale === "de") {
    return { key: "impressum", document: FIXED_DOCS.impressum };
  }
  if (locale === "es") {
    return { key: "aviso-legal", document: FIXED_DOCS["aviso-legal"] };
  }
  return { key: "legal-notes", document: getLegalNotesForLocale(locale) };
}

function getForcedDocument(key: LegalDocumentKey, locale: SupportedLocale): LegalDocument {
  if (key === "legal-notes") return getLegalNotesForLocale(locale);
  return FIXED_DOCS[key];
}

type LegalDocumentPageProps = {
  forcedKey?: LegalDocumentKey;
  forcedLocale?: SupportedLocale;
};

export function LegalDocumentPage({ forcedKey, forcedLocale }: LegalDocumentPageProps) {
  const { locale, t } = useI18n();
  const effectiveLocale = forcedLocale || locale;

  const document = forcedKey
    ? getForcedDocument(forcedKey, effectiveLocale)
    : resolveLegalDocumentForLocale(effectiveLocale).document;

  return (
    <div className="min-h-screen bg-[#ECF4FE]">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <a href="/" className="text-brand-600 hover:text-brand-700 text-sm">
            ← {t("legal.back_home")}
          </a>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">{document.title}</h1>
          <p className="text-gray-500 mt-2">{t("legal.last_updated")}: {LEGAL_LAST_UPDATED}</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          <p className="text-gray-700">{document.subtitle}</p>

          {document.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{section.title}</h2>
              <div className="space-y-3">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-gray-700 leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
