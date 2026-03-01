import { Link } from "react-router";
import { useI18n } from "~/hooks/useI18n";

export function FooterLight() {
  const { t, locale } = useI18n();
  const legalLabel =
    locale === "fr"
      ? "Mentions Légales"
      : locale === "de"
        ? "Impressum"
        : locale === "es"
          ? "Aviso Legal"
          : "Legal";
  return (
    <>
      {/* Mobile: Fixed footer */}
      <footer className="md:hidden bg-white border-t border-gray-200">
        <div className="px-4 pt-2 pb-0.5">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-gray-500">
            <Link to="/privacy-policy" className="hover:text-gray-600 transition-colors">
              {t("footer.privacy")}
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/cookie-policy" className="hover:text-gray-600 transition-colors">
              {t("footer.cookies")}
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/terms" className="hover:text-gray-600 transition-colors">
              {t("footer.terms")}
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/legal" className="hover:text-gray-600 transition-colors">
              {legalLabel}
            </Link>
          </div>
          <p className="text-center text-xs text-gray-500">
            © {new Date().getFullYear()} Runoot Exchange. {t("footer.rights")}
          </p>
        </div>
      </footer>

      {/* Desktop: Static footer */}
      <footer className="hidden md:block bg-white border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-gray-500">
            <span className="text-sm">© {new Date().getFullYear()} Runoot Exchange. {t("footer.rights")}</span>
            <div className="flex items-center gap-4 text-sm">
              <Link to="/privacy-policy" className="hover:text-gray-700 transition-colors">
                {t("footer.privacy")}
              </Link>
              <span className="text-gray-300">|</span>
              <Link to="/cookie-policy" className="hover:text-gray-700 transition-colors">
                {t("footer.cookies")}
              </Link>
              <span className="text-gray-300">|</span>
              <Link to="/terms" className="hover:text-gray-700 transition-colors">
                {t("footer.terms")}
              </Link>
              <span className="text-gray-300">|</span>
              <Link to="/legal" className="hover:text-gray-700 transition-colors">
                {legalLabel}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
