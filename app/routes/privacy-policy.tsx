import type { MetaFunction } from "react-router";
import { useI18n } from "~/hooks/useI18n";
import { getLegalPolicyDocument } from "~/lib/legalPolicies";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy | Runoot" },
    { name: "description", content: "How Runoot collects, uses, and protects personal data." },
  ];
};

export default function PrivacyPolicy() {
  const { locale, t } = useI18n();
  const doc = getLegalPolicyDocument("privacy", locale);

  return (
    <div className="min-h-screen bg-[#ECF4FE]">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <a href="/" className="text-brand-600 hover:text-brand-700 text-sm">
            ← {t("legal.back_home")}
          </a>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">{doc.title}</h1>
          <p className="mt-2 text-gray-500">{t("legal.last_updated")}: {doc.updatedAt}</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8 rounded-lg bg-white p-8 shadow-sm">
          <p className="text-gray-700">{doc.summary}</p>

          {doc.sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-4 text-xl font-semibold text-gray-900">{section.title}</h2>
              <div className="space-y-3">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="leading-relaxed text-gray-700">
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="space-y-2 text-gray-700">
                    {section.bullets.map((item) => (
                      <li key={item} className="flex items-start">
                        <span className="mr-2 text-brand-600">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <a href="/cookie-policy" className="hover:text-brand-600">{t("legal.cookie_policy")}</a>
          <span className="mx-2">•</span>
          <a href="/terms" className="hover:text-brand-600">{t("legal.terms_of_service")}</a>
          <span className="mx-2">•</span>
          <a href="/" className="hover:text-brand-600">{t("legal.back_home")}</a>
        </div>
      </main>
    </div>
  );
}
