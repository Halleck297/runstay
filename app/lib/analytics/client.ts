import type { AnalyticsEventName } from "~/lib/analytics/events";
import { CONSENT_CHANGED, CONSENT_KEY, readConsent } from "./consent";

type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;
declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;
let previousPage = "";
let lastPageKey = "";
let currentPage: { path: string; props?: AnalyticsProps } | null = null;
const adConsent = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };

export function measurementId() {
  const id = typeof window !== "undefined" ? window.ENV?.ANALYTICS_GA_MEASUREMENT_ID || "" : "";
  return /^G-[A-Z0-9]+$/.test(id) ? id : "";
}

// Free-text fields, user IDs, names, email addresses and search terms never leave the app.
export function safeAnalyticsProps(props: AnalyticsProps = {}): AnalyticsProps {
  const allowed = new Set(["locale", "has_user", "landing_source", "phase", "authenticated", "type_filter", "has_search", "sort", "preference", "race"]);
  return Object.fromEntries(Object.entries(props).filter(([key, value]) => allowed.has(key) && value != null && (typeof value !== "string" || /^[\w .+-]{1,60}$/.test(value))));
}

export function publicPage(path: string, origin: string): string | null {
  const url = new URL(path, origin);
  // Private routes can contain invitation/recovery tokens or other personal identifiers.
  const pathname = url.pathname.replace(/^\/(?:en|de|fr|it|es|nl|pt)(?=\/|$)/, "") || "/";
  if (url.origin !== origin || !/^\/(?:go|offer-entry|contact|privacy-policy|cookie-policy|terms|listings|events|about|professional-access)?\/?$/.test(pathname)) return null;
  const safe = new URL(url.pathname, origin);
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const value = url.searchParams.get(key);
    if (value && /^[\w .+-]{1,100}$/.test(value)) safe.searchParams.set(key, value);
  }
  return safe.href;
}

function canTrack() { return !!measurementId() && readConsent()?.preferences.analytics === true; }
function disableGoogle(disabled: boolean) {
  const id = measurementId();
  if (id) Object.assign(window, { [`ga-disable-${id}`]: disabled });
}

function deleteCookies(matcher: (name: string) => boolean) {
  const parts = window.location.hostname.split(".");
  const domains = ["", ...parts.map((_, i) => `;Domain=.${parts.slice(i).join(".")}`)];
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0].trim();
    if (matcher(name)) for (const domain of domains) document.cookie = `${name}=;Max-Age=0;Path=/${domain};SameSite=Lax`;
  }
}

function clearLegacyAnalytics() {
  deleteCookies(name => /^ph_.*_posthog$|^__ph_opt_in_out_/.test(name));
  for (const storageName of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[storageName];
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key && /^ph_.*_posthog$|^__ph_opt_in_out_/.test(key)) storage.removeItem(key);
      }
    } catch { /* Storage may be disabled. */ }
  }
}

export function initAnalytics(): void {
  if (typeof window === "undefined" || initialized || !canTrack()) return;
  initialized = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer!.push(arguments); };
  window.gtag("consent", "default", { ...adConsent, analytics_storage: "denied" });
  window.gtag("consent", "update", { ...adConsent, analytics_storage: "granted" });
  window.gtag("js", new Date());
  window.gtag("config", measurementId(), {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_expires: 180 * 24 * 60 * 60,
    cookie_update: false,
    page_location: publicPage(location.pathname + location.search, location.origin) || location.origin,
    page_referrer: safeReferrer(document.referrer),
  });
  const script = document.createElement("script");
  script.id = "runoot-ga4";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId()}`;
  document.head.appendChild(script);
}

function safeReferrer(referrer: string) {
  try { return new URL(referrer).origin + "/"; } catch { return ""; }
}

export function trackPage(path: string, props?: AnalyticsProps): void {
  if (typeof window === "undefined") return;
  currentPage = { path, props };
  const page = publicPage(path, window.location.origin);
  disableGoogle(!canTrack() || !page);
  if (!page || !canTrack()) { lastPageKey = ""; return; }
  if (page === lastPageKey) return;
  initAnalytics();
  window.gtag?.("config", measurementId(), { send_page_view: false, page_location: page, page_referrer: previousPage || safeReferrer(document.referrer) });
  window.gtag?.("event", "page_view", {
    page_location: page,
    page_referrer: previousPage || safeReferrer(document.referrer),
    ...safeAnalyticsProps(props),
  });
  previousPage = page;
  lastPageKey = page;
}

export function trackEvent(event: AnalyticsEventName, props?: AnalyticsProps): void {
  if (typeof window === "undefined" || !canTrack() || !publicPage(location.pathname, location.origin)) return;
  initAnalytics();
  window.gtag?.("event", event, { page_location: publicPage(location.pathname + location.search, location.origin), ...safeAnalyticsProps(props) });
}

export function startAnalytics() {
  clearLegacyAnalytics();
  const onConsent = () => {
    const granted = canTrack();
    disableGoogle(!granted);
    if (initialized) window.gtag?.("consent", "update", { ...adConsent, analytics_storage: granted ? "granted" : "denied" });
    if (!granted) {
      lastPageKey = "";
      deleteCookies(name => name === "_ga" || name.startsWith("_ga_") || name === "_gid" || name.startsWith("_gat"));
    } else if (currentPage) trackPage(currentPage.path, currentPage.props);
  };
  const onStorage = (event: StorageEvent) => { if (event.key === CONSENT_KEY || event.key === null) onConsent(); };
  onConsent();
  window.addEventListener(CONSENT_CHANGED, onConsent);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(CONSENT_CHANGED, onConsent); window.removeEventListener("storage", onStorage); };
}
