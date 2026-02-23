import { Link } from "react-router";
import { useI18n } from "~/hooks/useI18n";

export function NotFoundPage() {
  const { t } = useI18n();

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <img
          src="/logo.svg"
          alt="Runoot"
          className="mx-auto mb-4 h-28 w-auto"
        />
        <p className="text-sm font-semibold tracking-wide text-alert-600">404</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-gray-900">{t("not_found.title")}</h1>
        <p className="mt-3 text-gray-600">{t("not_found.description")}</p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/" className="btn-primary w-full sm:w-auto rounded-full px-6 py-2.5">
            {t("not_found.go_home")}
          </Link>
          <Link to="/contact?subject=bug" className="btn-secondary w-full sm:w-auto rounded-full px-6 py-2.5">
            {t("nav.contact")}
          </Link>
        </div>
      </div>
    </main>
  );
}
