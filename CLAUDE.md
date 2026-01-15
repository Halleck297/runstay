# CLAUDE.md - RunStay Exchange

## Project Overview

RunStay Exchange is a marketplace platform for tour operators and runners to exchange unsold hotel rooms and marathon bibs. The platform solves the problem of unsold inventory (rooms booked in advance that remain empty due to cancellations, no-shows, or unsold packages).

## Tech Stack

- **Framework**: Remix v2 with Vite (NOT Next.js)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (email/password + Google OAuth)
- **Styling**: Tailwind CSS
- **Hosting**: Vercel (planned)

## Key Architecture Decisions

### Why Remix over Next.js
The project owner is not a programmer and had frustrating experiences with Next.js App Router (Server Components, "use client" directives, confusing boundaries). Remix was chosen because:
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
runstay-exchange/
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
│   │   └── messages.$id.tsx     # Conversation (/messages/:id)
│   ├── styles/
│   │   └── tailwind.css
│   └── root.tsx             # App shell, global layout
├── public/
│   └── grid.svg             # Hero background pattern
├── supabase-schema.sql      # Database setup script
└── .env.example             # Environment variables template
```

## Database Schema

### Tables
- **profiles**: User data (extends Supabase auth.users)
- **events**: Marathon events (name, location, date)
- **listings**: Room/bib listings
- **conversations**: Chat threads between users
- **messages**: Individual messages

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

### Remix Patterns

Always use this structure for routes:

```tsx
// 1. Imports
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";

// 2. Meta export (for page title)
export const meta: MetaFunction = () => {
  return [{ title: "Page Title - RunStay Exchange" }];
};

// 3. Loader (GET data - runs on server)
export async function loader({ request, params }: LoaderFunctionArgs) {
  // Fetch data here
  return { data };
}

// 4. Action (POST/form handling - runs on server)
export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  // Process form, return json() or redirect()
}

// 5. Component (renders in browser)
export default function PageName() {
  const data = useLoaderData<typeof loader>();
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
- `.btn-primary` - Green primary button
- `.btn-secondary` - White/bordered button
- `.btn-accent` - Orange accent button
- `.input` - Form inputs
- `.label` - Form labels
- `.card` - White card with border and shadow

Brand colors:
- `brand-*`: Green tones (primary)
- `accent-*`: Orange tones (secondary)

Fonts:
- `font-sans` (DM Sans): Body text
- `font-display` (Sora): Headings

## Current Status (MVP Complete)

### Implemented ✅
- User registration (email + password, Tour Operator / Private)
- User login
- User dashboard with stats
- Create listings (room/bib/both)
- Browse listings with filters
- Listing detail page
- Internal messaging system
- Conversation threads
- Verified badge display
- Responsive design

### Not Yet Implemented ❌
- Google OAuth (configured but needs Google Cloud setup)
- Email notifications for new messages
- Edit listing page
- User settings/profile edit page
- Listing expiration
- Mark listing as sold
- Real-time message updates (polling only, no WebSocket yet)
- Image uploads for listings
- Search by event name (basic filter exists)
- Password reset flow

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
```

## Environment Variables

Required in `.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SESSION_SECRET=random-32-char-string
```

## Important Notes for Claude

1. **This is Remix, NOT Next.js** - Don't use Next.js patterns like `"use client"`, `getServerSideProps`, or `app/page.tsx` conventions.

2. **The owner is not a programmer** - Explain changes clearly, keep code simple and readable, avoid over-engineering.

3. **MVP mindset** - The goal is to validate the idea with real users. Don't add features that weren't requested. Keep it simple.

4. **No payments yet** - The platform is for matching only. Users handle transactions themselves.

5. **Language** - The UI is in English, but the owner speaks Italian. You can communicate in Italian if needed.

6. **Database changes** - Any new tables or columns need SQL added to `supabase-schema.sql` and types added to `database.types.ts`.

7. **Testing with real TOs** - The owner knows tour operators personally who will test the platform. Trust/verification is initially manual.
