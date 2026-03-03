# Analytics Architecture

This project now uses a vendor-agnostic client analytics layer.

## Core design

- Single API surface: `trackEvent`, `trackPage`, `identifyUser`, `resetAnalytics`
- Provider selected by env var, no app-wide refactor needed to switch
- Consent-aware: analytics events are sent only when `cookie_consent.preferences.analytics === true`

## Files

- `app/lib/analytics/client.ts`: provider adapters and runtime dispatch
- `app/lib/analytics/events.ts`: canonical event names

## Environment variables

- `ANALYTICS_PROVIDER`: `none` | `debug` | `posthog` | `plausible` | `ga4`
- `ANALYTICS_WRITE_KEY`: write key (used by PostHog)
- `ANALYTICS_HOST`: API host (optional, used by PostHog)
- `ANALYTICS_UI_HOST`: PostHog app host for toolbar/session links (for example `https://eu.posthog.com`)
- `ANALYTICS_DEBUG`: `true` or `false`
- `ANALYTICS_PLAUSIBLE_DOMAIN`: Plausible domain (required for Plausible)
- `ANALYTICS_GA_MEASUREMENT_ID`: GA4 measurement ID (required for GA4)

## Switching provider

1. Keep event names stable in `events.ts`
2. Change only env vars
3. Verify dashboards and custom props mapping

No route/component-level rewrites should be needed.

## PostHog proxy on Vercel (recommended)

- `vercel.json` rewrites `/ph/*` to PostHog ingest.
- Set:
  - `ANALYTICS_PROVIDER=posthog`
  - `ANALYTICS_WRITE_KEY=phc_...`
  - `ANALYTICS_HOST=/ph`
  - `ANALYTICS_UI_HOST=https://eu.posthog.com` (EU project) or `https://us.posthog.com` (US project)
