import { Link, useLocation } from "react-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "~/hooks/useI18n";
import type { TranslationKey } from "~/lib/i18n";

type PanelNavItem = {
  to: string;
  label?: string;
  labelKey?: TranslationKey;
  icon: ReactNode;
  exact?: boolean;
  badgeCount?: number;
  badgeTone?: "accent" | "brand";
  hideBadgeWhenActive?: boolean;
};

type ControlPanelLayoutProps = {
  panelLabel: string;
  mobileTitle: string;
  homeTo: string;
  user: {
    fullName?: string | null;
    email?: string | null;
    roleLabel?: string | null;
    avatarUrl?: string | null;
  };
  navItems: PanelNavItem[];
  children: ReactNode;
};

export function ControlPanelLayout({
  panelLabel,
  mobileTitle,
  homeTo,
  user,
  navItems,
  children,
}: ControlPanelLayoutProps) {
  const { t } = useI18n();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const userInitial =
    user.fullName?.trim()?.charAt(0) ||
    user.email?.trim()?.charAt(0)?.toUpperCase() ||
    "?";

  function isActive(to: string, exact?: boolean) {
    if (exact) return location.pathname === to;
    return location.pathname.startsWith(to);
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen md:h-screen bg-gray-100 flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed md:sticky md:top-0 inset-y-0 left-0 z-50 w-64 md:h-screen bg-navy-900 text-white flex flex-col transform transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-6 border-b border-navy-700">
          <Link to={homeTo} className="flex flex-col items-center gap-2 text-center">
            <img
              src="/Logosin.svg"
              alt="Runoot"
              className="h-20 w-auto"
            />
            <p className="text-xs font-bold text-white">{panelLabel}</p>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.to, item.exact);
            const showBadge =
              (item.badgeCount || 0) > 0 &&
              mounted &&
              !(item.hideBadgeWhenActive && active);
            const badgeClass = item.badgeTone === "brand" ? "bg-brand-500" : "bg-accent-500";

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-600 text-white"
                    : "text-navy-200 hover:bg-navy-800 hover:text-white"
                }`}
              >
                {item.icon}
                <span className="flex-1">{item.labelKey ? t(item.labelKey) : item.label}</span>
                <span
                  className={`ml-auto text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center ${
                    showBadge ? badgeClass : "invisible"
                  }`}
                >
                  {showBadge ? item.badgeCount : ""}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-navy-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-brand-500 flex items-center justify-center text-white text-sm font-bold">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.fullName || user.email || t("common.user")}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                userInitial
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.fullName || user.email || t("common.user")}
              </p>
              <p className="text-xs text-navy-400 capitalize">{user.roleLabel || t("common.member")}</p>
            </div>
          </div>
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-navy-300 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t("common.back_to_site")}
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 md:h-screen">
        <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <p className="font-display font-bold text-gray-900">{mobileTitle}</p>
          <Link to="/" className="p-2 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
        </header>

        <main className="flex-1 p-4 md:p-8 md:overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
