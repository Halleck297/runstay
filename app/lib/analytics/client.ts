import type { AnalyticsEventName } from "~/lib/analytics/events";
import posthog from "posthog-js";

type AnalyticsProvider = "none" | "debug" | "posthog" | "plausible" | "ga4";

type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

type AnalyticsConfig = {
  provider: AnalyticsProvider;
  key?: string;
  host?: string;
  uiHost?: string;
  debug?: boolean;
  plausibleDomain?: string;
  gaMeasurementId?: string;
};

type AnalyticsAdapter = {
  init: () => void;
  page: (path: string, props?: AnalyticsProps) => void;
  track: (event: string, props?: AnalyticsProps) => void;
  identify: (userId: string, traits?: AnalyticsProps) => void;
  reset: () => void;
};

declare global {
  interface Window {
    posthog?: typeof posthog;
    plausible?: (event: string, options?: { props?: Record<string, unknown> }) => void;
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
    __runoot_analytics_loaded__?: boolean;
  }
}

let initialized = false;
let adapter: AnalyticsAdapter = createNoopAdapter();

function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem("cookie_consent");
    if (!raw) return false;
    const parsed = JSON.parse(raw) as {
      type?: "all" | "necessary" | "custom";
      preferences?: { analytics?: boolean };
    };
    if (typeof parsed?.preferences?.analytics === "boolean") {
      return parsed.preferences.analytics;
    }
    if (parsed?.type === "all") return true;
    return false;
  } catch {
    return false;
  }
}

function safeProvider(value?: string): AnalyticsProvider {
  if (value === "debug" || value === "posthog" || value === "plausible" || value === "ga4") {
    return value;
  }
  return "none";
}

function getConfig(): AnalyticsConfig {
  if (typeof window === "undefined") return { provider: "none" };
  const env = window.ENV;
  return {
    provider: safeProvider(env?.ANALYTICS_PROVIDER),
    key: env?.ANALYTICS_WRITE_KEY,
    host: env?.ANALYTICS_HOST,
    uiHost: env?.ANALYTICS_UI_HOST,
    debug: env?.ANALYTICS_DEBUG === "true",
    plausibleDomain: env?.ANALYTICS_PLAUSIBLE_DOMAIN,
    gaMeasurementId: env?.ANALYTICS_GA_MEASUREMENT_ID,
  };
}

function ensureScript(src: string, attrs?: Record<string, string>): void {
  if (typeof document === "undefined") return;
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  Object.entries(attrs || {}).forEach(([k, v]) => script.setAttribute(k, v));
  document.head.appendChild(script);
}

function createNoopAdapter(): AnalyticsAdapter {
  return {
    init: () => undefined,
    page: () => undefined,
    track: () => undefined,
    identify: () => undefined,
    reset: () => undefined,
  };
}

function createDebugAdapter(config: AnalyticsConfig): AnalyticsAdapter {
  return {
    init: () => {
      if (config.debug) console.info("[analytics] debug adapter initialized");
    },
    page: (path, props) => console.info("[analytics] page", path, props || {}),
    track: (event, props) => console.info("[analytics] track", event, props || {}),
    identify: (userId, traits) => console.info("[analytics] identify", userId, traits || {}),
    reset: () => console.info("[analytics] reset"),
  };
}

function createPosthogAdapter(config: AnalyticsConfig): AnalyticsAdapter {
  return {
    init: () => {
      if (!config.key) return;
      posthog.init(config.key, {
        api_host: config.host || "/ph",
        ui_host: config.uiHost || "https://us.posthog.com",
        autocapture: false,
        capture_pageview: false,
        persistence: "localStorage+cookie",
        loaded: () => {
          // Expose for runtime diagnostics in browser console.
          if (typeof window !== "undefined") {
            window.posthog = posthog;
          }
          // Keep analytics state aligned with current cookie consent.
          if (hasAnalyticsConsent()) {
            posthog.opt_in_capturing();
          }
          if (config.debug) {
            console.info("[analytics] posthog initialized");
          }
        },
      });
    },
    page: (path, props) => {
      posthog.opt_in_capturing();
      posthog.capture("page_view", { path, ...(props || {}) });
    },
    track: (event, props) => {
      posthog.opt_in_capturing();
      posthog.capture(event, props || {});
    },
    identify: (userId, traits) => posthog.identify(userId, traits || {}),
    reset: () => posthog.reset(),
  };
}

function createPlausibleAdapter(config: AnalyticsConfig): AnalyticsAdapter {
  return {
    init: () => {
      const domain = config.plausibleDomain;
      if (!domain) return;
      ensureScript("https://plausible.io/js/script.js", { "data-domain": domain });
    },
    page: (path, props) => window.plausible?.("pageview", { props: { path, ...(props || {}) } }),
    track: (event, props) => window.plausible?.(event, { props: props || {} }),
    identify: () => undefined,
    reset: () => undefined,
  };
}

function createGa4Adapter(config: AnalyticsConfig): AnalyticsAdapter {
  return {
    init: () => {
      const id = config.gaMeasurementId;
      if (!id || typeof window === "undefined") return;
      ensureScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
      if (!window.dataLayer) window.dataLayer = [];
      if (!window.gtag) {
        window.gtag = function gtagShim(...args: unknown[]) {
          window.dataLayer?.push(args as unknown as Record<string, unknown>);
        };
      }
      window.gtag("js", new Date());
      window.gtag("config", id, { send_page_view: false });
    },
    page: (path, props) => window.gtag?.("event", "page_view", { page_path: path, ...(props || {}) }),
    track: (event, props) => window.gtag?.("event", event, props || {}),
    identify: () => undefined,
    reset: () => undefined,
  };
}

function buildAdapter(config: AnalyticsConfig): AnalyticsAdapter {
  switch (config.provider) {
    case "debug":
      return createDebugAdapter(config);
    case "posthog":
      return createPosthogAdapter(config);
    case "plausible":
      return createPlausibleAdapter(config);
    case "ga4":
      return createGa4Adapter(config);
    default:
      return createNoopAdapter();
  }
}

export function initAnalytics(): void {
  if (typeof window === "undefined") return;
  if (initialized) return;
  initialized = true;
  const config = getConfig();
  adapter = buildAdapter(config);
  adapter.init();
}

export function trackEvent(event: AnalyticsEventName, props?: AnalyticsProps): void {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;
  initAnalytics();
  adapter.track(event, props);
}

export function trackPage(path: string, props?: AnalyticsProps): void {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;
  initAnalytics();
  adapter.page(path, props);
}

export function identifyUser(userId: string, traits?: AnalyticsProps): void {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;
  initAnalytics();
  adapter.identify(userId, traits);
}

export function resetAnalytics(): void {
  if (typeof window === "undefined") return;
  adapter.reset();
}
