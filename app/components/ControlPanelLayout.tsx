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
  spacerTop?: boolean;
  badgeCount?: number;
  badgeTone?: "accent" | "brand";
  hideBadgeWhenActive?: boolean;
};

type ControlPanelLayoutProps = {
  panelLabel: string;
  mobileTitle: string;
  mobileSubtitle?: string;
  homeTo: string;
  user: {
    fullName?: string | null;
    email?: string | null;
    roleLabel?: string | null;
    avatarUrl?: string | null;
  };
  navItems: PanelNavItem[];
  topContent?: ReactNode;
  compactSidebarUnder391?: boolean;
  children: ReactNode;
};

export function ControlPanelLayout({
  panelLabel,
  mobileTitle,
  mobileSubtitle,
  homeTo,
  user,
  navItems,
  topContent,
  compactSidebarUnder391 = false,
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
    <div className="min-h-screen md:h-screen flex">
      {sidebarOpen && (
        <div
          className="fixed inset-x-0 top-[121px] bottom-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed md:sticky md:top-0 top-[121px] bottom-0 md:inset-y-0 left-0 z-50 w-64 md:h-screen bg-navy-900 text-white flex flex-col transform transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="px-6 pb-4 pt-3 border-b border-navy-700 md:border-navy-200 md:bg-white md:p-6">
          <Link
            to="/"
            className="mb-2 hidden items-center justify-center gap-2 text-xs transition-colors md:flex md:text-black md:hover:text-black"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t("common.back_to_site")}
          </Link>
          <div className="mb-3 hidden border-t border-navy-700 md:block" />
          <Link
            to={homeTo}
            className={
              compactSidebarUnder391
                ? "flex flex-col items-center gap-0.5 text-center md:gap-2 max-[390px]:items-start max-[390px]:text-left"
                : "flex flex-col items-center gap-0.5 text-center md:gap-2"
            }
          >
            <div className="flex items-center gap-2.5 md:hidden">
              <div className={compactSidebarUnder391 ? "h-10 w-10 rounded-full overflow-hidden bg-brand-500 flex items-center justify-center text-white text-sm font-bold max-[390px]:h-9 max-[390px]:w-9 max-[390px]:text-sm" : "h-10 w-10 rounded-full overflow-hidden bg-brand-500 flex items-center justify-center text-white text-sm font-bold"}>
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
              <div className="min-w-0 text-left">
                <p className={compactSidebarUnder391 ? "max-w-[10.5rem] truncate text-sm font-semibold text-white max-[390px]:text-[13px]" : "max-w-[10.5rem] truncate text-sm font-semibold text-white"}>
                  {user.fullName || user.email || t("common.user")}
                </p>
                <p className={compactSidebarUnder391 ? "text-xs text-navy-300 capitalize max-[390px]:text-[11px]" : "text-xs text-navy-300 capitalize"}>
                  {user.roleLabel || t("common.member")}
                </p>
              </div>
            </div>
            <img
              src="/logo225px.png"
              alt="Runoot"
              className={compactSidebarUnder391 ? "hidden h-14 w-auto max-[390px]:h-11 md:block md:h-20" : "hidden h-14 w-auto md:block md:h-20"}
            />
            <p className={compactSidebarUnder391 ? "hidden text-[11px] font-bold text-white max-[390px]:text-[10px] md:block md:text-sm md:font-bold md:text-brand-700" : "hidden text-[11px] font-bold text-white md:block md:text-sm md:font-bold md:text-brand-700"}>
              {panelLabel}
            </p>
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
                className={`${item.spacerTop ? "mt-2" : ""} flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
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
          <div className={compactSidebarUnder391 ? "mb-1 hidden items-center gap-2.5 text-left md:mb-4 md:flex md:flex-col md:items-center md:text-center max-[390px]:gap-2" : "mb-1 hidden items-center gap-2.5 text-left md:mb-4 md:flex md:flex-col md:items-center md:text-center"}>
            <div className={compactSidebarUnder391 ? "h-10 w-10 rounded-full overflow-hidden bg-brand-500 flex items-center justify-center text-white text-sm font-bold max-[390px]:h-9 max-[390px]:w-9 max-[390px]:text-sm md:h-12 md:w-12 md:text-base" : "h-10 w-10 rounded-full overflow-hidden bg-brand-500 flex items-center justify-center text-white text-sm font-bold md:h-12 md:w-12 md:text-base"}>
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
            <div className={compactSidebarUnder391 ? "min-w-0 md:mt-2 max-[390px]:md:mt-1" : "min-w-0 md:mt-2"}>
              <p className={compactSidebarUnder391 ? "max-w-[11rem] truncate text-sm font-semibold text-white max-[390px]:text-[13px] md:text-base" : "max-w-[11rem] truncate text-sm font-semibold text-white md:text-base"}>
                {user.fullName || user.email || t("common.user")}
              </p>
              <p className={compactSidebarUnder391 ? "text-xs text-navy-300 capitalize max-[390px]:text-[11px] md:text-sm" : "text-xs text-navy-300 capitalize md:text-sm"}>
                {user.roleLabel || t("common.member")}
              </p>
            </div>
          </div>
          <div className="mb-3 hidden border-t border-navy-700 md:block" />
          <Link
            to="/"
            className="hidden items-center justify-center gap-2 text-sm text-navy-300 hover:text-white transition-colors md:flex"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            {t("common.back_to_site")}
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex min-h-0 flex-col min-w-0 bg-[#ECF4FE] md:h-screen md:bg-[radial-gradient(circle_at_1px_1px,rgba(12,120,243,0.08)_1px,transparent_0)] md:bg-[size:18px_18px]">
        <header className="sticky top-[var(--mobile-nav-top-offset)] z-30 md:hidden bg-white border-b border-gray-200">
          <div className="px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen((current) => !current)}
              className="p-2 rounded-lg hover:bg-gray-100"
              aria-expanded={sidebarOpen}
              aria-label="Toggle panel menu"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <p className="font-display font-bold text-gray-900">{mobileTitle}</p>
            <Link to="/" className="rounded-lg px-2 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100">
              Home
            </Link>
          </div>
          <div id="panel-mobile-extra-row" className="relative z-40 bg-white">
            {mobileSubtitle && (
              <div className="px-4 pb-2 pt-0.5 text-center">
                <p className="font-display text-base font-bold text-gray-900 underline decoration-accent-500 underline-offset-4">{mobileSubtitle}</p>
              </div>
            )}
          </div>
        </header>

        {mounted && topContent && <div className="px-0 pb-0 pt-0 md:px-8 md:pt-8">{topContent}</div>}
        <main className="flex-1 min-h-0 overflow-hidden p-0 md:overflow-y-auto md:p-8">
          {mounted ? children : null}
        </main>
      </div>
    </div>
  );
}
