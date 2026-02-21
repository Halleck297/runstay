import { Link } from "react-router";
import { useI18n } from "~/hooks/useI18n";

export function FooterLight() {
  const { t } = useI18n();
  return (
    <>
      {/* Mobile: Fixed footer */}
      <footer className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200">
        <div className="flex flex-col items-center">
          <Link to="/" className="flex items-center -my-1">
            <img
              src="/logo.svg"
              alt="Runoot"
              className="h-14 w-auto"
            />
          </Link>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 -mt-1 pb-1">
            <span>© {new Date().getFullYear()}</span>
            <span>·</span>
            <Link to="/privacy-policy" className="hover:text-gray-600 transition-colors">
              {t("footer.privacy")}
            </Link>
            <span>·</span>
            <Link to="/cookie-policy" className="hover:text-gray-600 transition-colors">
              {t("footer.cookies")}
            </Link>
            <span>·</span>
            <Link to="/terms" className="hover:text-gray-600 transition-colors">
              {t("footer.terms")}
            </Link>
          </div>
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
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
