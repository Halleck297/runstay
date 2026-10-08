# agent.md - Runoot Exchange

Last updated: 9 October 2026.

## Project Overview

Runoot Exchange is a marketplace platform for tour operators and runners to exchange unsold hotel rooms and marathon bibs. The platform solves the problem of unsold inventory (rooms booked in advance that remain empty due to cancellations, no-shows, or unsold packages).

The public homepage currently presents **BibExchange by Runoot**: visitors submit their email, desired races and bib/package preferences without creating an account. Public signup requests requiring approval, race requests and optional last-minute mailing subscriptions are separate flows with separate consent and notification rules.

## Tech Stack

- **Framework**: React Router v7 with Vite
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (email/password + Google OAuth)
- **Styling**: Tailwind CSS
- **Hosting**: Vercel, production at `https://www.runoot.com`
- **Runtime**: Node.js 24.x (`package.json` engines and Vercel)
- **Email**: Resend for transactional emails; Contacts, Segments and Broadcasts for the new last-minute mailing list

## Key Architecture Decisions

### Why React Router v7
The architecture is built around React Router v7 route modules:
- Clearer mental model: `loader` = server data, `action` = form handling, component = UI
- No "use client" confusion - boundaries are explicit
- Easier debugging for non-programmers

### Why Supabase over Firebase
- PostgreSQL allows real SQL queries (Firebase Firestore has query limitations)
- Built-in auth that works similarly to Firebase
- Realtime capabilities for future chat enhancements
- Less vendor lock-in (standard PostgreSQL)
- Equivalent free tier

## Project Structure

```
runoot-exchange/
├── app/
│   ├── components/          # Reusable UI components
│   │   ├── Header.tsx       # Navigation header
│   │   └── ListingCard.tsx  # Listing preview card
│   ├── lib/                 # Server utilities
│   │   ├── database.types.ts    # TypeScript types for DB
│   │   ├── session.server.ts    # Cookie session management
│   │   └── supabase.server.ts   # Supabase client
│   ├── routes/              # File-based routing
│   │   ├── _index.tsx           # Homepage (/)
│   │   ├── login.tsx            # Login page
│   │   ├── register.tsx         # Registration
│   │   ├── logout.tsx           # Logout action
│   │   ├── dashboard.tsx        # User dashboard
│   │   ├── listings._index.tsx  # Browse listings (/listings)
│   │   ├── listings.new.tsx     # Create listing (/listings/new)
│   │   ├── listings.$id.tsx     # Listing detail (/listings/:id)
│   │   ├── messages._index.tsx  # Messages inbox (/messages)
│   │   ├── messages.$id.tsx     # Conversation loader/action (canonical URL: /messages?c=<id>)
│   │   └── $.tsx                # 404 catch-all route
│   ├── styles/
│   │   └── tailwind.css
│   └── root.tsx             # App shell, global layout
├── public/
│   └── grid.svg             # Hero background pattern
├── supabase-schema.sql      # Database setup script
└── .env.example             # Environment variables template
```

### Recent feature entry points

- `app/components/BibLanding.tsx`: public race request form and success screen.
- `app/lib/bib-requests.server.ts`: race request persistence and transactional confirmation.
- `app/components/MailingListOffer.tsx`: optional last-minute subscription popup after a successful request.
- `app/routes/api.mailing-list.subscribe.tsx`: signed invitation validation and confirmation email request.
- `app/routes/mailing-list.confirm.tsx`: explicit recipient confirmation; GET does not activate the subscription.
- `app/lib/mailing-list.server.ts`: consent records, signed invitations, confirmation tokens and manual additions.
- `app/lib/mailing-provider.server.ts`: server-only Resend contacts, segment membership and broadcasts.
- `app/lib/mailing-campaigns.server.ts`: campaign drafts, send locking and interrupted-send recovery.
- `app/routes/admin.mailing-list*.tsx`: subscriber management and campaign editor.
- `app/lib/email/templates/mailingList.ts`: confirmation and campaign email rendering.
- `app/routes/api.alerts.signup-requests.tsx`: daily Telegram alert for new pending signup requests.
- `migrations/20261008_mailing_list.sql`: new mailing list tables and permissions.
- `docs/MAILING_LIST.md`: activation instructions, delivery states and operational recovery.

## Database Schema

### Tables
- **profiles**: User data (extends Supabase auth.users)
- **events**: Marathon events (name, location, date)
- **listings**: Room/bib listings
- **conversations**: Chat threads between users
- **messages**: Individual messages
- **access_requests**: Requests for platform access, including `public_signup` requests awaiting approval
- **bib_requests**: Public race preferences and contact details; these do not imply mailing list consent
- **bib_offers**: Private entry offers submitted for review
- **mailing_list_signups**: Latest mailing consent request, historical confirmation, manual administrator reference and hashed single-use token; migration applied to production on 9 October 2026
- **mailing_list_campaigns**: Campaign content, author, delivery state and unique Resend broadcast ID; migration applied to production on 9 October 2026

The mailing tables have RLS enabled and access restricted to the service role. Resend is authoritative for current subscription status: `confirmed_at` records a past confirmation and must not be treated as proof that a contact is still subscribed.

### Key Relationships
- `listings.author_id` → `profiles.id`
- `listings.event_id` → `events.id`
- `conversations.listing_id` → `listings.id`
- `conversations.participant_1/2` → `profiles.id`
- `messages.conversation_id` → `conversations.id`

### Listing Types
- `room`: Hotel room only
- `bib`: Marathon bib only
- `room_and_bib`: Package deal

### User Types
- `tour_operator`: Professional TO (can have company name, verified badge)
- `private`: Individual runner

## Coding Conventions

### React Router v7 Patterns

Always use this structure for routes:

```tsx
// 1. Imports
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { data, redirect } from "react-router";
import { useLoaderData, useActionData, Form } from "react-router";

// 2. Meta export (for page title)
export const meta: MetaFunction = () => {
  return [{ title: "Page Title - Runoot" }];
};

// 3. Loader (GET data - runs on server)
export async function loader({ request, params }: LoaderFunctionArgs) {
  // Fetch data here
  return { someData };
}

// 4. Action (POST/form handling - runs on server)
export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  // Process form, return data() or redirect()
  // Note: use data() instead of the old json()
  return data({ error: "Something went wrong" }, { status: 400 });
}

// 5. Component (renders in browser)
export default function PageName() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div>
      {/* UI here */}
    </div>
  );
}
```

### Supabase Queries

```tsx
// Simple select
const { data, error } = await supabase
  .from("listings")
  .select("*")
  .eq("status", "active");

// With relations
const { data } = await supabase
  .from("listings")
  .select(`
    *,
    author:profiles(id, full_name, company_name),
    event:events(id, name, location, event_date)
  `)
  .eq("id", listingId)
  .single();

// Insert
const { data, error } = await supabase
  .from("listings")
  .insert({ ...fields })
  .select()
  .single();
```

### Authentication

```tsx
// In any route that needs auth:
import { requireUser, getUser } from "~/lib/session.server";

// Optional auth (page works without login)
const user = await getUser(request);

// Required auth (redirects to login if not authenticated)
const user = await requireUser(request);
```

### Styling

Use Tailwind CSS with these custom classes defined in `tailwind.css`:
- `.btn` - Base button
- `.btn-primary` - Primary button
- `.btn-secondary` - White/bordered button
- `.btn-accent` - Orange accent button
- `.input` - Form inputs
- `.label` - Form labels
- `.card` - White card with border and shadow

Brand colors:
- `brand-*`: Blue tones (primary)
- `accent-*`: Orange tones (secondary)

The public BibExchange pages use their existing styles in `app/styles/bib-landing.css`.

Fonts:
- `font-sans` (DM Sans): Body text
- `font-display` (Sora): Headings

## Recent Changes and Deployment State

### Telegram signup request alerts — published and verified

- Daily Vercel cron: `0 18 * * *`, at 18:00 UTC (20:00 Italian summer time / 19:00 winter time).
- Endpoint: `/api/alerts/signup-requests`; the old `/api/alerts/daily-summary` endpoint was removed.
- Counts `access_requests` with `source = public_signup` and `status = pending` within the most recently completed 24-hour window bounded by 18:00 UTC.
- Sends a Telegram message only when that count is greater than zero, linking to `/admin/access-requests`.
- Existing older pending requests and newly created user profiles do not trigger this daily alert.
- Production uses `CRON_SECRET` for authorization. Telegram credentials remain server-side.
- Relevant commits: `23e4975` (new alert flow), `0845654` (Node.js 24 runtime).

### Runoot Last Minute mailing list — published, provider connection verified

- Covers all last-minute opportunities: bibs, hotels, race packages and destinations, independently of the races selected in the original request.
- After a successful race request, the popup asks **“Want last-minute updates?”** and reuses the submitted email. It opens once per browser session; a button in the success screen lets the visitor reopen it.
- Subscription is optional. Declining does not change the saved race request.
- Website opt-in sends an email confirmation. Confirmation links expire after 72 hours, are stored as hashes, and can be consumed only once through an explicit POST confirmation.
- `/admin/mailing-list` supports direct manual additions with a required declaration that the person already gave consent. No confirmation email is required for these additions. Previously unsubscribed addresses must reconfirm themselves through the website.
- `/admin/mailing-list/campaigns` supports drafts, subject, inbox preview, plain-text message, optional HTTPS button, live email preview and explicit confirmation before sending to all active subscribers.
- Every campaign includes Resend's personalized unsubscribe link. Current opt-outs are read from Resend and excluded by its broadcast delivery system.
- Persist the provider broadcast ID before sending. Concurrent send requests are locked; ambiguous responses must be checked against the same broadcast instead of automatically resending or creating a copy.
- The privacy policy describes the separate mailing consent, provider and unsubscribe flow.
- Local checks passed: mailing list and existing race-confirmation tests, TypeScript, targeted lint, production build, and desktop/mobile browser checks with fake provider responses. No real campaign emails were sent during these checks.

**Database activation completed on 9 October 2026:** `migrations/20261008_mailing_list.sql` was applied in the Runoot production SQL Editor. Both tables have RLS enabled; `anon` and `authenticated` cannot read them, and the service role has read/write access. Direct API checks returned HTTP 200 for every expected column using the service role and denied anonymous reads.

**Resend configuration completed on 9 October 2026:** the owner created a dedicated Full access key and saved it as sensitive `RESEND_MARKETING_API_KEY` in Vercel Production. The empty **Runoot Last Minute** segment (`615bc712-53ec-4d9d-9dd4-c137b9192e51`) was created and configured as `RESEND_LAST_MINUTE_SEGMENT_ID`. The key value is not retrievable from Vercel. Its use was verified through the deployed admin subscriber loader, which successfully loaded the empty segment. Provider configuration trims surrounding whitespace; malformed values are rejected without exposing credentials.

**Published on 9 October 2026:** feature commit `95dd1c3` and configuration fix `1e479e8` were pushed to `main` and deployed by Vercel. The production admin loads subscribers without errors, the homepage and confirmation route respond, unauthenticated admin access redirects to login, and an invalid opt-in invitation is rejected without sending an email. No subscribers or campaigns were created during production verification.

**Remaining delivery check:** real inbox confirmation, campaign delivery and hosted unsubscribe still require controlled addresses and the owner's authorization. Use an isolated test segment for campaign checks. See [the mailing list guide](docs/MAILING_LIST.md).

For new environments, keep the segment setting unset until setup is ready; the public popup stays hidden without the mailing provider configuration. Never import existing race requests or account registrations into the mailing list without separate consent.

## Existing Platform Capabilities

### Implemented ✅
- User registration (email + password, Tour Operator / Private)
- User login
- User dashboard with stats
- Create listings (room/bib/both)
- Browse listings with filters
- Listing detail page
- Internal messaging system
- Conversation threads
- Canonical message URL with query param (`/messages?c=<conversation_id>`)
- Realtime + polling fallback for conversations/messages (cross-browser safe fallback)
- Verified badge display
- Responsive design
- User-friendly 404 and global error fallback pages
- Team Leader referral system:
  - `join/:code` referral attribution
  - TL dashboard with referral stats and management
  - Email batch invitations (max 10 at once)
  - Email reservation ownership (`referral_invites`) so invited emails stay attributed to the reserving TL
  - Auto-link referral on signup even without referral link when email is reserved
- Centralized transactional email architecture (`app/lib/email`)
  - Resend provider adapter
  - Template registry + typed payloads
  - Shared base email layout
  - Template IDs and payloads are defined in `app/lib/email/types.ts` and `registry.ts`
  - Recent additions include `bib_request_confirmation` and `mailing_list_confirmation`

### Earlier Backlog — Recheck Before Starting Work

This list predates the recent changes. Inspect current routes and services before assuming any item is still missing.
- Google OAuth (configured but needs Google Cloud setup)
- Email notifications for new messages
- Edit listing page
- User settings/profile edit page
- Listing expiration
- Mark listing as sold
- Typing indicator in chat
- Image uploads for listings
- Search by event name (basic filter exists)
- Dedicated admin/audit UI for email delivery tracking
- Full localization copy review for all email templates (`it/en/de/fr/es`)
- Production SMTP failover strategy

## Deferred Product Decisions (To Revisit)

Date noted: 2026-02-19

### Listing status: `sold`
- `sold` should be **manual only** (set by listing author, or admin override).
- Reason: current exchange flow is message-based and there is no reliable automatic signal that a deal is completed.
- Keep this as a user action in listing management (do not auto-infer from chat activity).

### Listing status: `expired`
- Keep expired listings in DB for history/audit/analytics.
- Do not show expired listings in public marketplace.
- Potential future UX: show expired only to the listing owner (archived/old listings area), with optional relist action.
- Final visibility/retention behavior is intentionally postponed until product direction is clearer.

## Development Commands

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type check
npm run typecheck

# Mailing list checks with fake credentials and intercepted network calls
node --import tsx scripts/test-mailing-list.ts

# Regression check for race request confirmation emails
node --import tsx scripts/test-bib-request-email.ts
```

## Environment Variables

Required in `.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-key
SESSION_SECRET=random-32-char-string
APP_URL=http://localhost:5173
APP_ORIGIN=http://localhost:5173
SESSION_COOKIE_SECURE=false
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM_EMAIL=Runoot <noreply@mail.yourdomain.com>
```

For the last-minute mailing list, configure these server-only values after preparing the database and Resend segment:

```dotenv
RESEND_MARKETING_API_KEY=your-full-access-resend-key
RESEND_LAST_MINUTE_SEGMENT_ID=your-dedicated-last-minute-segment-id
```

Choose **Full access** when creating the Resend key; **Sending access** cannot manage contacts, segments or broadcasts. There is no separate marketing-permission option.

The marketing adapter falls back to `RESEND_API_KEY` if a separate marketing key is absent, but that key must have contacts/broadcasts permissions. Confirmation emails continue to use the transactional sending key.

Production Telegram alerts also require `CRON_SECRET`, `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Set production `APP_URL`/`APP_ORIGIN` to the canonical HTTPS origin and use secure session cookies. Keep actual secret values out of source files and documentation.

## Email System Notes

- Reset password currently uses Supabase Auth built-in recovery flow (`/recover`) and Supabase-hosted template.
- App-managed transactional emails (invites/notifications) must go through `sendTemplatedEmail(...)` in `app/lib/email/service.server.ts`.
- Mailing opt-in confirmations also use `sendTemplatedEmail(...)`. Mass promotional sends use the dedicated Resend Broadcasts adapter, with provider-managed recipient selection and unsubscribe handling.
- Keep templates separated by purpose in `app/lib/email/templates`.
- Supported email locale types are `en`, `it`, `de`, `fr`, `es`, `nl`, `pt`. Current public BibExchange and last-minute subscription copy is in English.

## Important Notes for Coding Agents

1. **This is React Router v7, NOT Next.js** - Don't use Next.js patterns like `"use client"`, `getServerSideProps`, or `app/page.tsx` conventions. Use React Router APIs and imports from `"react-router"`.

2. **The owner is not a programmer** - Explain changes clearly, keep code simple and readable, avoid over-engineering.

3. **MVP mindset** - The goal is to validate the idea with real users. Don't add features that weren't requested. Keep it simple.

4. **No payments yet** - The platform is for matching only. Users handle transactions themselves.

5. **Language** - The UI is in English, but the owner speaks Italian. You can communicate in Italian if needed.

6. **Database changes** - Any new tables or columns need a migration in `migrations/`, SQL added to `supabase-schema.sql`, and types added to `app/lib/database.types.ts`. Record whether the migration has actually been applied to production.

7. **Testing with real TOs** - The owner knows tour operators personally who will test the platform. Trust/verification is initially manual.

8. **Separate flows** - Platform signup approval, race request follow-up and last-minute mailing consent have different purposes. Preserve their separate data, opt-in choices and notifications.

9. **Mailing list checks** - Use fake provider responses for automated tests. Any live delivery verification must use an isolated test segment with controlled addresses. Publishing the feature must not send a campaign or enroll existing users automatically.

10. **Report actual completion** - Distinguish local implementation and simulated tests from applied migrations, configured provider access, commits and verified production deployment.
