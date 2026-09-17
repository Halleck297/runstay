# Google Analytics 4

Runoot uses GA4 only. The PostHog SDK, proxy and public configuration have been removed. Historical PostHog data is not imported into Google Analytics and the external PostHog account is not deleted.

## Setup

The Runoot Web stream uses the public measurement ID `G-JGXDVBTR9E`, supplied by the owner. It is the default in the root loader; `ANALYTICS_GA_MEASUREMENT_ID` can override it for other deployments. Use `disabled` as an override to disable analytics locally. Without a valid ID no Google script loads. Old PostHog environment variables have no effect and may be removed from hosting settings.

In the Web stream, disable Enhanced Measurement (especially automatic page views/history changes and form interactions). The application emits manual SPA `page_view` and `generate_lead` events. This avoids double counting and collection of form-related data. Leave Google signals, advertising features and user-provided data collection off. Set event data retention to 2 months and turn off renewal on new activity.

Register event-scoped custom dimensions `landing_source`, `race` and `preference` to use them in reports. Mark `generate_lead` as a key event. Verify actual arrivals in Realtime/DebugView after deployment; an inserted tag alone does not prove ingestion.

## Consent and coverage

Basic consent mode: Google is not loaded until the visitor explicitly accepts analytics. All advertising consent types stay denied. Rejecting or leaving the banner unanswered sends no application analytics events. A returning visitor must consent again when the saved choice is older than 180 days, invalid, or from the previous PostHog version. Consent changes apply immediately; revocation disables Google measurement and removes accessible GA cookies. Cookie settings are available in the landing footer and cookie policy.

GA4 cannot count all visitors: refusals, blocked scripts and network failures reduce coverage. The database remains the source of truth for saved requests and QR/site attribution regardless of analytics consent. Request email consent is independent from cookie consent.

Only public pages are measured; account, administration and token-bearing routes are excluded. Names, emails, custom race text, free-text search, account IDs, URL fragments and arbitrary query parameters are not sent. Safe UTM parameters are retained. A single custom race is reported as `Another race`; a selection of several races is reported as `Multiple races`. Choosing both offer types sends preference `both`. Each successful submission emits one lead event, regardless of the number of races. A confirmed successful form submission emits `generate_lead`; repeat successful submissions can appear as repeat conversions while the database deduplicates email + race.

`landing_source=qr` means the current landing path is `/go`; `site` means home or a language homepage. A shared `/go` link also counts as QR. Register these as custom dimensions before building source reports. Previous PostHog cookies/storage are cleared on page initialization where accessible.

## Verification

Run `node --import tsx scripts/test-analytics.ts`, `npm run typecheck` and `npm run build`. Verify unknown/accepted/rejected consent, immediate activation after acceptance, revocation, navigation deduplication, private-route exclusion and no personal form fields in Google events. Verify a real successful request still saves when analytics is rejected.
