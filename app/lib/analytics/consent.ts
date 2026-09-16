export const CONSENT_KEY = "cookie_consent";
export const CONSENT_VERSION = "2.0-ga4";
export const CONSENT_CHANGED = "runoot:consent-changed";
export const CONSENT_OPEN = "runoot:consent-open";
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
type Consent = { version: string; timestamp: string; preferences: { necessary: true; analytics: boolean; marketing: false } };
let sessionConsent: Consent | null = null;
let storageUnavailable = false;

export function parseConsent(raw: string | null, now = Date.now()): Consent | null {
  try {
    const value = JSON.parse(raw || "null");
    const age = now - Date.parse(value?.timestamp);
    return value?.version === CONSENT_VERSION && typeof value?.preferences?.analytics === "boolean" && age >= 0 && age < MAX_AGE_MS ? value : null;
  } catch { return null; }
}

export function readConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  if (storageUnavailable) return sessionConsent;
  try { return parseConsent(window.localStorage.getItem(CONSENT_KEY)); }
  catch { return sessionConsent; }
}

export function saveConsent(analytics: boolean) {
  sessionConsent = { version: CONSENT_VERSION, timestamp: new Date().toISOString(), preferences: { necessary: true, analytics, marketing: false } };
  try { window.localStorage.setItem(CONSENT_KEY, JSON.stringify(sessionConsent)); storageUnavailable = false; }
  catch { storageUnavailable = true; }
  document.cookie = `${CONSENT_KEY}=${analytics ? "analytics" : "necessary"};Max-Age=${MAX_AGE_MS / 1000};Path=/;SameSite=Lax${location.protocol === "https:" ? ";Secure" : ""}`;
  window.dispatchEvent(new Event(CONSENT_CHANGED));
}

export function reopenCookieBanner() {
  window.dispatchEvent(new Event(CONSENT_OPEN));
}
