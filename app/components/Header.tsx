import { Link, Form, useFetcher, useLocation } from "react-router";
import { useEffect, useState, useRef } from "react";
import type { Database } from "~/lib/database.types";
import { useUnreadCount } from "~/hooks/useUnreadCount";
import { useI18n } from "~/hooks/useI18n";
import { getLocaleFromPreferredLanguage, isSupportedLocale, LOCALE_LABELS } from "~/lib/locale";
import type { SupportedLocale } from "~/lib/locale";
import { LocaleSwitcher } from "~/components/LocaleSwitcher";
import { LocalePersistPrompt } from "~/components/LocalePersistPrompt";

type Profile = Database["public"]["Tables"]["profiles"]["Row"] & {
  unreadCount?: number;
  unreadNotifications?: number;
};

interface HeaderProps {
  user: Profile | null;
}

const LOCALE_PERSIST_PROMPT_KEY = "runoot_locale_persist_prompt";

export function Header({ user }: HeaderProps) {
  const { t, locale } = useI18n();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState<SupportedLocale>(locale);
  const [pendingLocale, setPendingLocale] = useState<SupportedLocale | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const localeFetcher = useFetcher<{ success?: boolean; locale?: string }>();
  const location = useLocation();
  const preferredLocale = getLocaleFromPreferredLanguage((user as any)?.preferred_language);

  const submitLocaleChange = (nextLocale: SupportedLocale, persist: "0" | "1") => {
    localeFetcher.submit(
      {
        locale: nextLocale,
        persist,
        redirectTo: `${location.pathname}${location.search}`,
      },
      { method: "post", action: "/api/locale" }
    );
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mediaQuery.matches);
    update();

    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  // Chiudi menu quando si clicca fuori (per mobile)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside as any);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside as any);
    };
  }, [isMenuOpen]);

  const { unreadMessages, unreadNotifications } = useUnreadCount({
    userId: user?.id || "",
    initialMessages: (user as any)?.unreadCount ?? 0,
    initialNotifications: (user as any)?.unreadNotifications ?? 0,
    enabled: isDesktop,
  });
  const hasAnyUnread = unreadMessages + unreadNotifications > 0;

  useEffect(() => {
    setSelectedLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (typeof window === "undefined" || !user) return;

    const queuedLocale = window.sessionStorage.getItem(LOCALE_PERSIST_PROMPT_KEY);
    if (!isSupportedLocale(queuedLocale)) return;
    if (queuedLocale !== locale) return;

    window.sessionStorage.removeItem(LOCALE_PERSIST_PROMPT_KEY);
    if (preferredLocale === queuedLocale) return;
    setPendingLocale(queuedLocale);
  }, [locale, preferredLocale, user]);

  useEffect(() => {
    if (localeFetcher.state !== "idle" || !localeFetcher.data?.success) return;
    if (typeof window === "undefined") return;

    const localeCodes = Object.keys(LOCALE_LABELS);
    const parts = location.pathname.split("/").filter(Boolean);
    const hasLocalePrefix = parts.length > 0 && localeCodes.includes(parts[0]);
    const strippedPath = hasLocalePrefix ? `/${parts.slice(1).join("/")}` : location.pathname;
    const normalizedPath = strippedPath === "" ? "/" : strippedPath;
    const resolvedLocale =
      localeFetcher.data?.locale && localeFetcher.data.locale in LOCALE_LABELS
        ? (localeFetcher.data.locale as SupportedLocale)
        : selectedLocale;
    const localizedPath = `/${resolvedLocale}${normalizedPath === "/" ? "" : normalizedPath}${location.search}`;
    window.location.assign(localizedPath);
  }, [localeFetcher.state, localeFetcher.data, location.pathname, location.search, selectedLocale]);

  const handleLocaleChange = (locale: SupportedLocale) => {
    if (typeof window !== "undefined") {
      if (user && preferredLocale !== locale) {
        window.sessionStorage.setItem(LOCALE_PERSIST_PROMPT_KEY, locale);
      } else {
        window.sessionStorage.removeItem(LOCALE_PERSIST_PROMPT_KEY);
      }
    }

    setSelectedLocale(locale);
    submitLocaleChange(locale, "0");
  };

  return (
    <>
    <header className="hidden md:block sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-4 md:px-0">

        {/* Desktop Header */}
        <div className="hidden md:flex h-20 items-center justify-between">

          {/* Logo */}
          <Link to="/" className="flex items-center mt-2">
           <img
             src="/logo.svg"
             alt="Runoot"
             className="h-32 w-auto"
           />
         </Link>

{/* Center Navigation Links */}
<nav className="flex items-center gap-10 flex-1 justify-center">
  <Link
    to="/listings"
    className="text-base font-bold text-gray-700 hover:text-accent-500 hover:underline transition-colors"
  >
    {t("nav.listings")}
  </Link>
  <Link
    to="/contact"
    className="text-base font-bold text-gray-700 hover:text-accent-500 hover:underline transition-colors"
  >
    {t("nav.contact")}
  </Link>
</nav>

{/* Right Side Navigation */}
{user ? (
  <nav className="flex items-center">
    <div className="hidden md:flex items-center gap-6">
      <div className="relative">
        <LocaleSwitcher value={selectedLocale} onChange={handleLocaleChange} />
        <LocalePersistPrompt
          open={pendingLocale !== null}
          className="right-0 left-auto"
          languageLabel={pendingLocale ? LOCALE_LABELS[pendingLocale] : ""}
          onClose={() => {
            setPendingLocale(null);
          }}
          onKeepTemporary={() => {
            setPendingLocale(null);
          }}
          onMakeDefault={() => {
            if (!pendingLocale) return;
            setSelectedLocale(pendingLocale);
            submitLocaleChange(pendingLocale, "1");
            setPendingLocale(null);
          }}
        />
      </div>

      {/* User menu dropdown - hidden on mobile, shown on desktop */}
<div
  ref={menuRef}
  className="relative"
  onMouseEnter={() => setIsMenuOpen(true)}
  onMouseLeave={() => setIsMenuOpen(false)}
>
<button
  onClick={() => setIsMenuOpen(!isMenuOpen)}
  className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-full bg-white hover:bg-gray-50 text-gray-900 transition-colors"
>
  {/* Pallino rosso notifiche */}
  {hasAnyUnread && (
    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
  )}
  <span className="text-sm font-bold max-w-[150px] truncate">{user.full_name || user.email}</span>
  <svg
    className={`h-4 w-4 text-gray-500 transition-transform flex-shrink-0 ${isMenuOpen ? 'rotate-180' : ''}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
</button>



        {/* Dropdown menu */}
        {isMenuOpen && (
          <>
            
            
            {/* Menu */}
            <div className="absolute right-0 top-full w-48 sm:w-56 rounded-2xl bg-white shadow-lg border border-gray-200 py-2 z-20">

              {/* Dashboard - solo per Tour Operators */}
{user.user_type === "tour_operator" && (
  <Link
    to="/dashboard"
    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
   
  >
    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
    <span className="flex-1">{t("nav.dashboard")}</span>
  </Link>
)}

              <Link
                to="/profile"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"

              >
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {t("nav.profile")}
              </Link>

              {/* My Listings - link condizionale */}
              <Link
                to={user.user_type === "tour_operator" ? "/dashboard" : "/my-listings"}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {user.user_type === "tour_operator" ? t("nav.my_listings") : t("nav.my_listing")}
              </Link>

              <Link
                to="/messages"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                
              >
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="flex-1">{t("nav.messages")}</span>
                {/* Pallino rosso nel dropdown */}
                {unreadMessages > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </Link>

              <Link
                to="/saved"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"

              >
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {t("nav.saved")}
              </Link>

              {/* TL Dashboard - solo per Team Leaders */}
              {(user as any).is_team_leader && (
                <>
                  <Link
                    to="/tl-dashboard"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-purple-700 hover:bg-purple-50"
                  >
                    <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="flex-1">{t("nav.tl_dashboard")}</span>
                  </Link>
                  <Link
                    to="/tl-events"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-brand-700 hover:bg-brand-50"
                  >
                    <svg className="h-5 w-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
                    </svg>
                    <span className="flex-1">{t("nav.new_event")}</span>
                  </Link>
                </>
              )}

              {/* Admin Dashboard - solo admin/superadmin */}
              {((user as any).role === "admin" || (user as any).role === "superadmin") && (
                <Link
                  to="/admin"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-alert-700 hover:bg-alert-50"
                >
                  <svg className="h-5 w-5 text-alert-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15l8.66-5-8.66-5-8.66 5 8.66 5zm0 0v6m0-6L3.34 10M20.66 10L12 15" />
                  </svg>
                  <span className="flex-1">{t("nav.admin_dashboard")}</span>
                </Link>
              )}

              {/* Divisore */}
              <div className="my-2 border-t border-gray-100" />

              <Link
                to="/settings"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                
              >
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t("nav.settings")}
              </Link>

              <Form method="post" action="/logout">
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  {t("nav.logout")}
                </button>
              </Form>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 mr-6">
        <Link
          to="/listings/new"
          className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-accent-500/30"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>{t("nav.new_listing")}</span>
        </Link>
        {(user as any)?.is_team_leader && (
          <Link
            to="/tl-events"
            className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/30"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>{t("nav.new_event")}</span>
          </Link>
        )}
      </div>
    </div>
  </nav>
) : (
  <nav className="flex items-center gap-4">
    <LocaleSwitcher value={selectedLocale} onChange={handleLocaleChange} />
    <Link to="/login" className="btn-secondary rounded-full">
      {t("nav.login")}
    </Link>
    <Link to="/register" className="btn-primary rounded-full shadow-lg shadow-accent-500/30">
      {t("nav.signup")}
    </Link>
  </nav>
)}

        </div>
      </div>
    </header>
    </>
  );
}
