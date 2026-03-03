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
- A server route proxy `app/routes/ph.$.tsx` is also present to prevent locale catch-all routes from intercepting `/ph/*` POST requests.
- Set:
  - `ANALYTICS_PROVIDER=posthog`
  - `ANALYTICS_WRITE_KEY=phc_...`
  - `ANALYTICS_HOST=/ph`
  - `ANALYTICS_UI_HOST=https://eu.posthog.com` (EU project) or `https://us.posthog.com` (US project)

## PostHog setup checklist

1. Create dashboard cards for:
   - `page_view`
   - `home_search_submitted`
   - `home_search_suggestion_clicked`
   - `home_view_all_listings_clicked`
   - `home_view_all_events_clicked`
   - `listings_search_submitted`
   - `listings_search_suggestion_clicked`
   - `listings_sort_changed`
   - `contact_form_submitted`
2. Build conversion funnel:
   - `page_view` (home)
   - `home_view_all_listings_clicked` or `home_search_submitted`
   - `listings_search_submitted` or `listings_search_suggestion_clicked`
   - `contact_form_submitted` (`phase=success`)
3. Useful properties already sent:
   - common: `locale`, `has_user`
   - search/listings: `query`, `event_name`, `type_filter`, `has_search`
   - contact: `phase`, `subject`, `authenticated`
   - person properties on identify: `user_type`, `preferred_language`, `country`, `verified`
