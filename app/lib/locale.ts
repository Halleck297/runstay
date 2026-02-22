const SUPPORTED_LOCALES = ["en", "de", "fr", "it", "es", "nl", "pt"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";
export const LOCALE_COOKIE_NAME = "runoot_locale";
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Francais",
  it: "Italiano",
  es: "Espanol",
  nl: "Nederlands",
  pt: "Portugues",
};

export const LOCALE_FLAGS: Record<SupportedLocale, string> = {
  en: "🇬🇧",
  de: "🇩🇪",
  fr: "🇫🇷",
  it: "🇮🇹",
  es: "🇪🇸",
  nl: "🇳🇱",
  pt: "🇵🇹",
};

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export function getSupportedLocales(): readonly SupportedLocale[] {
  return SUPPORTED_LOCALES;
}

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  if (!value) return false;
  return (SUPPORTED_LOCALES as readonly string[]).includes(value.toLowerCase());
}

export function getLocaleFromPathname(pathname: string): SupportedLocale | null {
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0]?.toLowerCase();
  return isSupportedLocale(first) ? first : null;
}

export function stripLocaleFromPathname(pathname: string): string {
  const locale = getLocaleFromPathname(pathname);
  if (!locale) return pathname || "/";

  const stripped = pathname.replace(new RegExp(`^/${locale}(?=/|$)`), "");
  return stripped || "/";
}

export function getLocaleFromCookie(cookieHeader: string | null): SupportedLocale | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [rawName, ...rawValueParts] = cookie.trim().split("=");
    if (rawName !== LOCALE_COOKIE_NAME) continue;
    const value = rawValueParts.join("=").trim().toLowerCase();
    if (isSupportedLocale(value)) return value;
  }

  return null;
}

export function getLocaleFromAcceptLanguage(header: string | null): SupportedLocale | null {
  if (!header) return null;

  const preferred = header
    .split(",")
    .map((token) => token.trim().split(";")[0]?.toLowerCase())
    .filter(Boolean);

  for (const candidate of preferred) {
    const base = candidate.split("-")[0];
    if (isSupportedLocale(base)) return base;
  }

  return null;
}

export function detectPreferredLocale(request: Request): SupportedLocale {
  const url = new URL(request.url);
  const fromPath = getLocaleFromPathname(url.pathname);
  if (fromPath) return fromPath;

  const fromHeader = getLocaleFromAcceptLanguage(request.headers.get("Accept-Language"));
  if (fromHeader) return fromHeader;

  const fromCookie = getLocaleFromCookie(request.headers.get("Cookie"));
  if (fromCookie) return fromCookie;

  return DEFAULT_LOCALE;
}

export function resolveLocaleForRequest(
  request: Request,
  preferredLanguage: string | null | undefined
): SupportedLocale {
  const url = new URL(request.url);
  const fromPath = getLocaleFromPathname(url.pathname);
  if (fromPath) return fromPath;

  const fromProfile = getLocaleFromPreferredLanguage(preferredLanguage);
  if (fromProfile) return fromProfile;

  const fromHeader = getLocaleFromAcceptLanguage(request.headers.get("Accept-Language"));
  if (fromHeader) return fromHeader;

  const fromCookie = getLocaleFromCookie(request.headers.get("Cookie"));
  if (fromCookie) return fromCookie;

  return DEFAULT_LOCALE;
}

export function buildLocaleCookie(locale: SupportedLocale): string {
  return `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax`;
}

export function getLocaleFromPreferredLanguage(value: string | null | undefined): SupportedLocale | null {
  if (!value) return null;

  const candidates = value
    .split(/[,\s;|/]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  for (const candidate of candidates) {
    const base = candidate.split("-")[0];
    if (isSupportedLocale(base)) return base;
  }

  return null;
}

export function getLocaleFromProfileLanguages(value: string | null | undefined): SupportedLocale | null {
  return getLocaleFromPreferredLanguage(value);
}

function readLocalizedValue(
  baseValue: string | null | undefined,
  i18nValue: Record<string, string> | null | undefined,
  locale: SupportedLocale
): string | null {
  if (i18nValue && typeof i18nValue === "object") {
    const localized = i18nValue[locale];
    if (typeof localized === "string" && localized.trim()) return localized.trim();

    const fallback = i18nValue[DEFAULT_LOCALE];
    if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
  }

  if (typeof baseValue === "string" && baseValue.trim()) return baseValue.trim();
  return null;
}

export function localizeEvent<T extends Record<string, any>>(event: T, locale: SupportedLocale): T {
  if (!event) return event;

  return {
    ...event,
    name: readLocalizedValue(event.name, event.name_i18n, locale) ?? event.name,
    location: readLocalizedValue(event.location, event.location_i18n, locale) ?? event.location,
    country: readLocalizedValue(event.country, event.country_i18n, locale) ?? event.country,
  };
}

export function localizeListing<T extends Record<string, any>>(listing: T, locale: SupportedLocale): T {
  if (!listing) return listing;

  return {
    ...listing,
    title: readLocalizedValue(listing.title, listing.title_i18n, locale) ?? listing.title,
    description: readLocalizedValue(listing.description, listing.description_i18n, locale) ?? listing.description,
    hotel_name: readLocalizedValue(listing.hotel_name, listing.hotel_name_i18n, locale) ?? listing.hotel_name,
    hotel_city: readLocalizedValue(listing.hotel_city, listing.hotel_city_i18n, locale) ?? listing.hotel_city,
    hotel_country: readLocalizedValue(listing.hotel_country, listing.hotel_country_i18n, locale) ?? listing.hotel_country,
    event: listing.event ? localizeEvent(listing.event, locale) : listing.event,
  };
}
