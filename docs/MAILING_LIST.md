# Runoot Last Minute mailing list

## Operation

- A successful race request offers a separate, optional subscription for all last-minute updates (bibs, hotels, packages and destinations).
- The invitation opens once per browser session. The success card also has a button to reopen it.
- Public subscriptions require an email confirmation. Opening the link does not activate anything: the recipient confirms on the page. Links expire after 72 hours and are single use.
- `/admin/mailing-list` lists contacts and supports manual additions with a required declaration of existing consent. Manual additions activate immediately. Previously unsubscribed contacts must confirm a new website subscription themselves.
- `/admin/mailing-list/campaigns` supports drafts, a live preview, a link button and an explicit send confirmation. Campaigns go to active members of the dedicated Resend segment.
- Resend stores the current subscription status and processes campaign delivery. Every campaign includes its hosted unsubscribe link. No webhook is needed to exclude opt-outs; the admin reads current provider state. Race-request emails remain transactional and independent.

## First activation

1. **Completed in production on 9 October 2026:** `migrations/20261008_mailing_list.sql` was applied to the Runoot database. For another environment, apply the same migration there. The new tables are server-only: no anonymous/authenticated access.
2. **Configured in production on 9 October 2026:** dedicated segment **Runoot Last Minute** (`615bc712-53ec-4d9d-9dd4-c137b9192e51`). It was created empty. Do not populate it from existing race requests or account registrations.
3. **Configured for Vercel Production on 9 October 2026:** the owner created a Full access key, saved as a sensitive environment variable. The segment ID was added separately. Required values for each environment (never put keys in browser variables or version control):
   - `RESEND_MARKETING_API_KEY`: contacts, segments and broadcasts access.
   - `RESEND_LAST_MINUTE_SEGMENT_ID`: the dedicated segment UUID.
   - Keep the existing `RESEND_API_KEY` for transactional confirmation emails and `RESEND_FROM_EMAIL` for the verified sender.
   - `SESSION_SECRET` signs the short-lived subscription invitation; `APP_URL` must be the production HTTPS origin.
4. Verify that the account has a marketing plan/contact allowance suitable for the list. Provider limits and billing are separate from this application.
5. **Published and connection verified on 9 October 2026:** commits `95dd1c3` and `1e479e8` are deployed to `www.runoot.com`. The authenticated admin Subscribers page successfully reads the empty Resend segment and the new database tables. Public confirmation is available; invalid invitations are rejected, and unauthenticated admin access requires login. Configuration values tolerate surrounding whitespace; credentials are never included in connection diagnostics. With the segment unset in other environments, the homepage invitation is hidden, while existing race requests continue working.
6. **Real delivery verification remains pending:** with the owner's authorization, use an address you control to submit a race request, opt in, receive/confirm the email, and check the active subscriber in the admin. Send a campaign to a dedicated test segment containing only controlled addresses, verify its unsubscribe link, and verify that an opted-out recipient is excluded from the next test campaign. Use a separate deployment/environment for the test segment. Never test mass sending against the live list. Production verification has not enrolled contacts or sent emails.

The database migration, new environment values and production deployment are separate steps; source changes alone do not activate the feature.

### Resend API key choice

In **API Keys → Create API Key**, choose **Full access** and name the key **Runoot Last Minute**. Resend currently offers `full_access` and `sending_access`: the latter can only send emails, while this feature also manages contacts, segment membership and broadcasts. There is no separate “marketing access” choice; `RESEND_MARKETING_API_KEY` is simply the application's environment variable name for this dedicated Full access key.

Store the new value as `RESEND_MARKETING_API_KEY` in the server/deployment environment. Keep the existing transactional key in `RESEND_API_KEY`. Set the UUID of the **Runoot Last Minute** segment as `RESEND_LAST_MINUTE_SEGMENT_ID`. Do not put secret values in source control or chat messages. See [Resend's API key permissions](https://resend.com/docs/api-reference/api-keys/create-api-key).

### Database access

The application is linked to Supabase project `qfvduapzgyobukdpykwv`. To apply the migration, use an authenticated Supabase CLI session (`supabase db query --linked --file migrations/20261008_mailing_list.sql`) or run that complete file in the project's SQL Editor. The app's service-role key is for database API access; it is not a Supabase Management API login.

On 9 October 2026, the migration was applied through the authenticated Supabase SQL Editor in the Runoot production project. Both tables were verified with RLS enabled, `anon`/`authenticated` SELECT denied, and service-role SELECT/INSERT/UPDATE enabled. Application API checks confirmed all expected columns were accessible with the service key (HTTP 200) and anonymous reads were denied (Postgres `42501`). No subscriber records or campaigns were created.

The local CLI still needs its own login before future Management API operations. Database activation does not publish the website or configure Resend.

## Delivery and recovery

Only one request can claim a draft for delivery. The application creates an unsent Resend broadcast and saves its ID before requesting a send. It never automatically retries an ambiguous send. Closing the browser does not interrupt accepted deliveries.

- **Draft:** editable, unsent. A stale editor cannot overwrite a newer saved draft.
- **Preparing:** creating an unsent provider draft. If interrupted for more than two minutes, **Refresh status** recovers the local draft. Any orphan provider draft is unsent and can be removed in Resend.
- **Ready:** a provider draft exists; sending uses that same ID.
- **Sending:** delivery was requested. If the response was lost, refresh the provider status. If it remains a draft, inspect and, if appropriate, send the **existing** broadcast in Resend, then refresh here. Do not copy the email to retry.
- **Submitted:** accepted into the provider workflow, not proof of inbox delivery. The detail view displays the current provider status; Resend has delivery details. A copy can be created as a separate new draft.

## Data

`mailing_list_signups` stores the latest consent request, timestamp, consent version/text, manual administrator reference and historical confirmation. `confirmed_at` is not current subscription status. Current opt-outs live in Resend. Unsubscribe does not delete the limited consent record or cancel race requests.

`mailing_list_campaigns` stores drafts, author, state and the unique provider broadcast ID. Content is plain text with escaped HTML and an optional HTTPS button; recipients cannot be supplied by a client request.

No existing contacts are imported and no campaigns are sent by setup or deployment.

## Local checks

```sh
node --import tsx scripts/test-mailing-list.ts
node --import tsx scripts/test-bib-request-email.ts
npm run typecheck
npm run build
```

The mailing test intercepts all network requests and uses fake credentials. It covers consent, signed invitations, token expiry/replay, opt-out, recipient resubscription, manual activation, admin authorization, content escaping, concurrent sends and uncertain delivery recovery.

Provider documentation: [Contacts](https://resend.com/docs/api-reference/contacts/create-contact), [Segments](https://resend.com/docs/api-reference/segments/list-segment-contacts), [Broadcasts](https://resend.com/docs/api-reference/broadcasts/create-broadcast).
