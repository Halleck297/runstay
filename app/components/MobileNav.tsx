import { Link, useLocation, Form, useFetcher } from "react-router";
import { useEffect, useState } from "react";
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

interface MobileNavProps {
  user: Profile | null;
}

const LOCALE_PERSIST_PROMPT_KEY = "runoot_locale_persist_prompt";

export function MobileNav({ user }: MobileNavProps) {
  const { t, locale } = useI18n();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState<SupportedLocale>(locale);
  const [pendingLocale, setPendingLocale] = useState<SupportedLocale | null>(null);
  const localeFetcher = useFetcher<{ success?: boolean; locale?: string }>();
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

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mediaQuery.matches);
    update();

    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  const { unreadMessages } = useUnreadCount({
    userId: user?.id || "",
    initialMessages: (user as any)?.unreadCount ?? 0,
    initialNotifications: (user as any)?.unreadNotifications ?? 0,
    enabled: isMobile,
  });

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

  // Close sidebar when route changes
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  // Don't show on login/register/join pages
  if (location.pathname === "/login" || location.pathname === "/register" || location.pathname.startsWith("/join/")) {
    return null;
  }

  // Check if current path matches
  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  // My Listing path depends on user type
  const myListingPath = user?.user_type === "tour_operator" ? "/dashboard" : "/my-listings";

  return (
    <>
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-50"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Drawer (now opens from top) */}
      <div
        className={`md:hidden fixed top-16 right-2 w-56 bg-white rounded-2xl shadow-xl z-50 transform transition-all duration-200 ease-out ${
          isSidebarOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center gap-3 p-3 border-b border-gray-100">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-semibold text-sm">
            {user?.full_name?.charAt(0) || user?.email?.charAt(0) || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 text-sm truncate">{user?.full_name || t("common.user")}</p>
            <p className="text-[10px] text-gray-500">{user?.user_type === 'tour_operator' ? t("common.tour_operator") : t("common.private")}</p>
          </div>
        </div>

        <div className="px-3 pt-2 relative">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
              {t("nav.language")}
          </label>
          <LocaleSwitcher
            value={selectedLocale}
            onChange={handleLocaleChange}
            buttonClassName="w-full justify-between rounded-lg"
            menuClassName="left-0 right-0 w-auto"
          />
          <LocalePersistPrompt
            open={pendingLocale !== null}
            className="left-0 right-0 w-auto z-50"
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

        {/* Sidebar Menu */}
        <div className="py-1">
          {/* Dashboard - solo per Tour Operators */}
          {user?.user_type === "tour_operator" && (
            <Link
              to="/dashboard"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="flex-1">{t("nav.dashboard")}</span>
            </Link>
          )}

          <Link
            to="/profile"
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {t("nav.profile")}
          </Link>

          <Link
            to={myListingPath}
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {user?.user_type === "tour_operator" ? t("nav.my_listings") : t("nav.my_listing")}
          </Link>

          <Link
            to="/saved"
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {t("nav.saved")}
          </Link>

          {/* TL Dashboard - solo per Team Leaders */}
          {(user as any)?.is_team_leader && (
            <>
              <Link
                to="/tl-dashboard"
                onClick={() => setIsSidebarOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50"
              >
                <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="flex-1">{t("nav.tl_dashboard")}</span>
              </Link>
              <Link
                to="/tl-events"
                onClick={() => setIsSidebarOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-brand-700 hover:bg-brand-50"
              >
                <svg className="h-4 w-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
                </svg>
                <span className="flex-1">{t("nav.new_event")}</span>
              </Link>
            </>
          )}

          {/* Admin Dashboard - solo admin/superadmin */}
          {((user as any)?.role === "admin" || (user as any)?.role === "superadmin") && (
            <Link
              to="/admin"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-alert-700 hover:bg-alert-50"
            >
              <svg className="h-4 w-4 text-alert-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15l8.66-5-8.66-5-8.66 5 8.66 5zm0 0v6m0-6L3.34 10M20.66 10L12 15" />
              </svg>
              <span className="flex-1">{t("nav.admin_dashboard")}</span>
            </Link>
          )}

          <div className="my-1 border-t border-gray-100" />

          <Link
            to="/settings"
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {t("nav.settings")}
          </Link>

          <Form method="post" action="/logout">
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {t("nav.logout")}
            </button>
          </Form>
        </div>
      </div>

      {/* Top Navigation (inverted from bottom) */}
      <nav className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-40 safe-area-top">
      <div className="flex items-center justify-around h-16 px-2">
        {/* Home */}
        <Link
          to="/"
          className={`flex flex-col items-center justify-center flex-1 py-2 ${
            isActive("/") && !isActive("/listings") && !isActive("/messages") && !isActive("/profile") && !isActive("/my-listings") && !isActive("/dashboard")
              ? "text-brand-600"
              : "text-gray-500"
          }`}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive("/") && !isActive("/listings") ? 2.5 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[10px] mt-0.5 font-medium">{t("nav.home")}</span>
        </Link>

        {/* Listings/Search */}
        <Link
          to="/listings"
          className={`flex flex-col items-center justify-center flex-1 py-2 ${
            isActive("/listings") && !location.pathname.includes("/new")
              ? "text-brand-600"
              : "text-gray-500"
          }`}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive("/listings") && !location.pathname.includes("/new") ? 2.5 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-[10px] mt-0.5 font-medium">{t("nav.search")}</span>
        </Link>

        {/* New */}
        <Link
          to={user ? ((user as any)?.is_team_leader ? "/tl-events" : "/listings/new") : "/login"}
          className={`flex flex-col items-center justify-center flex-1 py-2 ${
            location.pathname === "/listings/new" || location.pathname === "/tl-events"
              ? "text-accent-600"
              : "text-gray-500"
          }`}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={location.pathname === "/listings/new" || location.pathname === "/tl-events" ? 2.5 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-[10px] mt-0.5 font-medium">{(user as any)?.is_team_leader ? t("nav.event") : t("nav.new")}</span>
        </Link>

        {/* Messages */}
        {user ? (
          <Link
            to="/messages"
            className={`flex flex-col items-center justify-center flex-1 py-2 relative ${
              isActive("/messages")
                ? "text-brand-600"
                : "text-gray-500"
            }`}
          >
            <div className="relative">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive("/messages") ? 2.5 : 2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {/* Badge notifiche */}
              {unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-medium">{t("nav.messages")}</span>
          </Link>
        ) : (
          <Link
            to="/login"
            className="flex flex-col items-center justify-center flex-1 py-2 text-gray-500"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-[10px] mt-0.5 font-medium">{t("nav.messages")}</span>
          </Link>
        )}

        {/* Profile / Menu */}
        {user ? (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className={`flex flex-col items-center justify-center flex-1 py-2 ${
              isActive("/profile") || isActive("/settings") || isActive("/saved") || isActive(myListingPath)
                ? "text-brand-600"
                : "text-gray-500"
            }`}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive("/profile") || isActive("/settings") || isActive("/saved") ? 2.5 : 2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-[10px] mt-0.5 font-medium">{t("nav.profile")}</span>
          </button>
        ) : (
          <Link
            to="/login"
            className="flex flex-col items-center justify-center flex-1 py-2 text-gray-500"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-[10px] mt-0.5 font-medium">{t("nav.login")}</span>
          </Link>
        )}
      </div>
    </nav>
    </>
  );
}
