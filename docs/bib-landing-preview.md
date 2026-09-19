# BibExchange landing — operation and restoration

The English landing is shared by `/`, `/go` and existing language homepages. `/go` submissions are saved as `qr`; home submissions as `site`. This is a path-based attribution convention: a shared `/go` link also counts as QR. Print `https://runoot.com/go` on the banner. Photos and Instagram remain deferred.

## Requests

Races and offer types allow multiple selections: click to select, click again to deselect. At least one race and one offer type are required; custom race names remain free text. One submission saves one row per distinct race in a single database operation, with `both` for interest in either offer type. The admin dashboard groups these records into one card per email, including requests made at different times. It counts runners and races separately and paginates by runner, keeping every runner's matching races together.

The form saves first name, last name, email, race (including a custom race), bib/package preference, creation time, source, landing path and consent text/version in `public.bib_requests`. Confirmation appears only after a successful database write. Email addresses are self-reported, not verified. Each submission that saves new races sends one English confirmation email through the existing Resend service, with the newly saved races, preference, next steps and support/withdrawal contact. A submission containing only existing email/race pairs sends no new email. In a mixed submission, the email lists only newly saved races, avoiding a misleading summary of older preferences. Matching and opportunity emails remain manual.

The confirmation uses the existing `RESEND_API_KEY` and `RESEND_FROM_EMAIL` configuration and the `bib_request_confirmation` template. Sending is awaited with the provider's existing timeout. The page reports whether sending succeeded; provider acceptance is not proof of inbox delivery. A send failure leaves the request saved, tells the runner not to resubmit, and is recorded in the existing Email Errors admin page (`/admin/email-logs`); unexpected logging failures fall back to server logs. Failed emails are not retried automatically, and repeating the same request does not retry the email. Tests use fake network responses and send no real mail: `node --import tsx scripts/test-bib-request-email.ts`.

Only authorized administrators can read and delete requests at `/admin/bib-requests`, with QR/site filters and pagination. Each race retains its preference, source and date. A repeated email + race preserves the original request, timestamp, preference and source. A different race creates a new request. Withdrawal/deletion requests go to support@runoot.com and can be handled with the dashboard's Delete request button. An inline confirmation lists the races being permanently removed. With a source filter active, deletion removes only the displayed races; records arriving later and requests from another source remain untouched. Deletion requires an administrator session and a same-origin POST. No personal information is automatically shared with tour operators.

The grouped dashboard works with existing data and needs no database migration. It reads email-only batches to count and paginate runners, then fetches details for the selected page. This scans all matching email records on each load; if the list grows substantially, move grouping and pagination into a database view/RPC. Checks: `node --import tsx scripts/test-admin-bib-requests.ts`, `npm run typecheck`, `npm run build`.

The server validates input and consent, checks request origin, and includes a honeypot and process-local rate limits. The IP allowance accommodates shared hotel Wi-Fi; a separate email limit restricts repeated submissions. Rate limits reset on restart and are not shared across server instances. Supabase RLS blocks direct public access; only the server service role can access the table.

## Deployment

Apply `migrations/20260916_bib_requests.sql` and `migrations/20260917_bib_requests_both_preference.sql` to the project's Supabase database before deploying. It is also included in `supabase-schema.sql` for fresh setup. Existing production environment variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are required. No new third-party service is needed. Deployment follows the existing GitHub main → Vercel pipeline.

Checks: `npm run typecheck`, `node --import tsx scripts/test-bib-requests.ts`, `npm run build`. Verify a real disposable submission through both paths, attribution, deduplication and anonymous-access denial, then delete only the test records. Existing `npm run check` also runs an i18n audit that reports missing translation keys in the pre-existing dashboard.

`node --env-file=.env scripts/smoke-bib-landing.mjs https://www.runoot.com` checks real submissions and deletes only its uniquely identified disposable records. Set `BIB_SMOKE_EMAIL` to a disposable inbox you control with no existing bib requests: this check now sends real confirmation emails and must be explicitly run against that test recipient. Production publication and the original check succeeded on 2026-09-16. The dependency audit found pre-existing advisories, addressed with React Router 7.18.4, patched DOMPurify/qs/esbuild overrides and compatible lockfile updates. The resulting npm audit reports zero vulnerabilities.

## Preserved project

The previous home remains byte-for-byte in `app/routes/_index.backup.tsx`, ignored by the filesystem router. Existing marketplace and account routes remain available at their existing URLs. Landing markup lives in `app/components/BibLanding.tsx`; styling is scoped in `app/styles/bib-landing.css`.

To restore the marketplace home, restore `_index.tsx` from the backup and revert the locale-home delegation and homepage changes in `root.tsx`. Keep `/go` and request data if the campaign should remain active. The deployment commit records all changes for a precise rollback.

## Landing support pages (local draft, 17 September 2026)

`/privacy-policy` and `/contact` now use `BibInfoLayout` and the landing stylesheet. The previous pages are preserved as ignored `.backup.tsx` files. Contact is a direct mailto link to support@runoot.com, not an in-site message form. The cookie banner links to the new privacy page’s cookie section.

Before publication, complete the controller’s legal identity and address: the prior policy only identified “Runoot, Italy”; no legal entity details have been supplied. The owner selected a retention limit of 24 months from the last request, with earlier withdrawal/deletion on request. The policy now states that limit. Deletion is currently an administrator task, not an implemented automatic retention job. A reliable expiry workflow, including how repeat submissions renew the last-request date (duplicates currently preserve original records), remains to be finalized before relying on automatic expiry. Confirm the GA property’s server-side retention independently of the tag’s 180-day cookie duration.

## Runner entry offers

The home and language homepages have a “Sell your bib” header link; `/go` has no offer link. `/offer-entry` is a runner-only availability form. Tour operator inventory remains out of this flow. Reports are stored in the private `bib_offers` table and readable by administrators at `/admin/bib-offers`. No public listing, payment, automatic email, or transfer approval occurs. Reported transfer permissions are unverified and need manual review, especially unknown permissions.

Apply `migrations/20260917_bib_offers.sql` and `migrations/20260917_bib_offers_phone.sql` before enabling submissions; both have been applied to the linked database. Phone is required by the form and server validation and is visible in the admin panel; the database permits null for historical records. The schema is also included in `supabase-schema.sql`. The existing 24-month retention policy now includes offers; deletion remains manual. Checks: `node --import tsx scripts/test-bib-offers.ts` and `node --env-file=.env scripts/smoke-bib-offers.mjs BASE_URL`. The latter removes only its own uniquely identified test record.
