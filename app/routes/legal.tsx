import type { MetaFunction } from "react-router";
import { useI18n } from "~/hooks/useI18n";

type LegalSection = {
  title: string;
  paragraphs: string[];
};

type LegalDocument = {
  title: string;
  subtitle: string;
  sections: LegalSection[];
};

const DEFAULT_UPDATED = "27 February 2026";

const LEGAL_DOCS: Record<string, LegalDocument> = {
  default: {
    title: "Legal",
    subtitle: "Legal notice and publisher information for Runoot.",
    sections: [
      {
        title: "1. Publisher Information",
        paragraphs: [
          "Website: runoot.com",
          "Operator: Runoot (company details to be completed before publication).",
          "Registered address: [Insert legal address].",
          "Email: legal@runoot.com",
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
  fr: {
    title: "Mentions Légales",
    subtitle: "Informations légales relatives à l'éditeur du site Runoot.",
    sections: [
      {
        title: "1. Éditeur du Site",
        paragraphs: [
          "Site: runoot.com",
          "Éditeur: Runoot (informations sociales à compléter avant publication).",
          "Adresse du siège: [À compléter].",
          "Contact: legal@runoot.com",
        ],
      },
      {
        title: "2. Hébergement",
        paragraphs: [
          "Le site est hébergé par Vercel Inc., avec une infrastructure répartie sur plusieurs régions.",
          "Des services techniques complémentaires sont fournis par Supabase Inc.",
        ],
      },
      {
        title: "3. Responsabilité",
        paragraphs: [
          "Runoot agit en tant que plateforme d'annonces et n'intervient pas comme partie aux transactions entre utilisateurs.",
          "Chaque utilisateur est responsable des informations publiées et des accords conclus avec d'autres utilisateurs.",
        ],
      },
      {
        title: "4. Propriété Intellectuelle",
        paragraphs: [
          "Les contenus, marques et éléments graphiques du site sont protégés par les lois en vigueur.",
          "Toute reproduction sans autorisation écrite préalable est interdite.",
        ],
      },
    ],
  },
  de: {
    title: "Impressum",
    subtitle: "Anbieterkennzeichnung und rechtliche Hinweise zu Runoot.",
    sections: [
      {
        title: "1. Angaben gemäß § 5 TMG",
        paragraphs: [
          "Website: runoot.com",
          "Betreiber: Runoot (vollständige Firmendaten vor Veröffentlichung ergänzen).",
          "Anschrift: [Eintragen].",
          "E-Mail: legal@runoot.com",
        ],
      },
      {
        title: "2. Hosting",
        paragraphs: [
          "Die Plattform wird bei Vercel Inc. gehostet, mit Infrastruktur in mehreren Regionen.",
          "Zusätzliche Backend-Dienste werden durch Supabase Inc. bereitgestellt.",
        ],
      },
      {
        title: "3. Haftung für Inhalte",
        paragraphs: [
          "Runoot ist eine Anzeigenplattform und nicht Vertragspartei bei Transaktionen zwischen Nutzern.",
          "Für Inhalte von Inseraten und die Durchführung von Vereinbarungen sind ausschließlich die jeweiligen Nutzer verantwortlich.",
        ],
      },
      {
        title: "4. Urheberrecht",
        paragraphs: [
          "Inhalte, Marken und Design-Elemente der Plattform unterliegen dem Urheber- und Kennzeichenrecht.",
          "Eine Nutzung außerhalb der gesetzlichen Schranken ist nur mit vorheriger schriftlicher Zustimmung zulässig.",
        ],
      },
    ],
  },
  es: {
    title: "Aviso Legal",
    subtitle: "Información legal y titularidad del sitio Runoot.",
    sections: [
      {
        title: "1. Titular del Sitio Web",
        paragraphs: [
          "Sitio web: runoot.com",
          "Titular: Runoot (datos societarios pendientes de completar antes de publicación).",
          "Domicilio social: [Completar].",
          "Correo de contacto: legal@runoot.com",
        ],
      },
      {
        title: "2. Alojamiento",
        paragraphs: [
          "La plataforma está alojada en Vercel Inc., con infraestructura distribuida en varias regiones.",
          "Servicios técnicos adicionales son provistos por Supabase Inc.",
        ],
      },
      {
        title: "3. Responsabilidad",
        paragraphs: [
          "Runoot opera como plataforma de anuncios y no interviene como parte en las transacciones entre usuarios.",
          "Cada usuario es responsable de la información publicada y de los acuerdos celebrados con terceros.",
        ],
      },
      {
        title: "4. Propiedad Intelectual",
        paragraphs: [
          "Las marcas, logotipos y contenidos del sitio están protegidos por la normativa de propiedad intelectual aplicable.",
          "Queda prohibida su reproducción o distribución sin autorización previa y por escrito.",
        ],
      },
    ],
  },
};

export const meta: MetaFunction = () => {
  return [
    { title: "Legal | Runoot" },
    { name: "description", content: "Legal information for Runoot." },
  ];
};

export default function LegalPage() {
  const { locale, t } = useI18n();
  const doc = LEGAL_DOCS[locale] || LEGAL_DOCS.default;

  return (
    <div className="min-h-screen bg-[#ECF4FE]">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <a href="/" className="text-brand-600 hover:text-brand-700 text-sm">
            ← {t("legal.back_home")}
          </a>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">{doc.title}</h1>
          <p className="text-gray-500 mt-2">{t("legal.last_updated")}: {DEFAULT_UPDATED}</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          <p className="text-gray-700">{doc.subtitle}</p>

          {doc.sections.map((section) => (
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
