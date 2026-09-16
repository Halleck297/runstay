# BibExchange landing — operation and restoration

The English landing is shared by `/`, `/go` and existing language homepages. `/go` submissions are saved as `qr`; home submissions as `site`. This is a path-based attribution convention: a shared `/go` link also counts as QR. Print `https://runoot.com/go` on the banner. Photos and Instagram remain deferred.

## Requests

The form saves first name, last name, email, race (including a custom race), bib/package preference, creation time, source, landing path and consent text/version in `public.bib_requests`. Confirmation appears only after a successful database write. Email addresses are self-reported, not verified. No confirmation or opportunity emails are sent automatically; matching and communication are currently manual.

Only authorized administrators can read requests at `/admin/bib-requests`, with QR/site filters and pagination. A repeated email + race preserves the original request, timestamp, preference and source. A different race creates a new request. Withdrawal/deletion requests go to support@runoot.com and need to be handled by an administrator in Supabase. No personal information is automatically shared with tour operators.

The server validates input and consent, checks request origin, and includes a honeypot and process-local rate limits. The IP allowance accommodates shared hotel Wi-Fi; a separate email limit restricts repeated submissions. Rate limits reset on restart and are not shared across server instances. Supabase RLS blocks direct public access; only the server service role can access the table.

## Deployment

Apply `migrations/20260916_bib_requests.sql` to the project's Supabase database before deploying. It is also included in `supabase-schema.sql` for fresh setup. Existing production environment variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are required. No new third-party service is needed. Deployment follows the existing GitHub main → Vercel pipeline.

Checks: `npm run typecheck`, `node --import tsx scripts/test-bib-requests.ts`, `npm run build`. Verify a real disposable submission through both paths, attribution, deduplication and anonymous-access denial, then delete only the test records. Existing `npm run check` also runs an i18n audit that reports missing translation keys in the pre-existing dashboard.

`node --env-file=.env scripts/smoke-bib-landing.mjs https://www.runoot.com` checks real submissions and deletes only its uniquely identified disposable records. Production publication and this check succeeded on 2026-09-16. The dependency audit found pre-existing advisories, addressed with React Router 7.18.4, patched DOMPurify/qs/esbuild overrides and compatible lockfile updates. The resulting npm audit reports zero vulnerabilities.

## Preserved project

The previous home remains byte-for-byte in `app/routes/_index.backup.tsx`, ignored by the filesystem router. Existing marketplace and account routes remain available at their existing URLs. Landing markup lives in `app/components/BibLanding.tsx`; styling is scoped in `app/styles/bib-landing.css`.

To restore the marketplace home, restore `_index.tsx` from the backup and revert the locale-home delegation and homepage changes in `root.tsx`. Keep `/go` and request data if the campaign should remain active. The deployment commit records all changes for a precise rollback.
