# RunStay Exchange

A marketplace for tour operators and runners to exchange unsold hotel rooms and marathon bibs.

## Tech Stack

- **Framework**: React Router v7 (React)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (Email + Google)
- **Styling**: Tailwind CSS
- **Hosting**: Vercel (free)

## Getting Started

### 1. Clone and Install

```bash
# Navigate to the project folder
cd runstay-exchange

# Install dependencies
npm install
```

### 2. Setup Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (choose a region close to you)
3. Wait for the project to be ready (~2 minutes)

#### Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `supabase-schema.sql` and paste it
4. Click **Run** (or Cmd/Ctrl + Enter)
5. You should see "Success. No rows returned"

#### Get Your API Keys

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (under Project API keys)

### 3. Setup Environment Variables

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` with your values:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SESSION_SECRET=any-random-string-at-least-32-characters-long
```

To generate a session secret, you can use:
```bash
openssl rand -base64 32
```

### 4. Setup Google Auth (Optional)

If you want Google login:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Go to **APIs & Services** → **Credentials**
4. Create **OAuth 2.0 Client ID** (Web application)
5. Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
6. Copy Client ID and Client Secret
7. In Supabase: **Authentication** → **Providers** → **Google**
8. Enable and paste your Google credentials

### 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/runstay-exchange.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Import Project**
3. Select your repository
4. Add Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SESSION_SECRET`
5. Click **Deploy**

Your app will be live at `https://your-app.vercel.app`

## Project Structure

```
runstay-exchange/
├── app/
│   ├── components/       # Reusable UI components
│   │   ├── Header.tsx
│   │   └── ListingCard.tsx
│   ├── lib/              # Utilities and server code
│   │   ├── database.types.ts
│   │   ├── session.server.ts
│   │   └── supabase.server.ts
│   ├── routes/           # Pages (file-based routing)
│   │   ├── _index.tsx          # Homepage
│   │   ├── login.tsx           # Login page
│   │   ├── register.tsx        # Registration page
│   │   ├── logout.tsx          # Logout action
│   │   ├── dashboard.tsx       # User dashboard
│   │   ├── listings._index.tsx # Browse listings
│   │   ├── listings.new.tsx    # Create listing
│   │   ├── listings.$id.tsx    # Listing detail
│   │   ├── messages._index.tsx # Messages inbox
│   │   ├── messages.$id.tsx    # Conversation loader/action
│   │   └── $.tsx               # 404 catch-all
│   ├── styles/
│   │   └── tailwind.css
│   └── root.tsx          # App shell
├── public/               # Static files
├── supabase-schema.sql   # Database setup script
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

## Key Features

- ✅ User authentication (email + Google)
- ✅ Two user types: Tour Operators and Private Runners
- ✅ Create listings (rooms, bibs, or both)
- ✅ Browse and filter listings
- ✅ Internal messaging system
- ✅ Canonical message URLs (`/messages?c=<conversation_id>`)
- ✅ Realtime + polling fallback for message updates
- ✅ Verified badge for trusted sellers
- ✅ Responsive design
- ✅ 404 and global error fallback pages

## React Router Basics

### How Routes Work

Each file in `app/routes/` becomes a page:
- `_index.tsx` → `/`
- `login.tsx` → `/login`
- `listings._index.tsx` → `/listings`
- `listings.$id.tsx` → `/listings/[any-id]`

### The Three Functions

Every route can have three main parts:

```tsx
// 1. LOADER - Runs on the server, fetches data
export async function loader({ request }) {
  const data = await db.query()
  return { data }
}

// 2. ACTION - Runs on the server, handles forms
export async function action({ request }) {
  const form = await request.formData()
  await db.insert(form)
  return redirect('/success')
}

// 3. DEFAULT EXPORT - The React component (runs in browser)
export default function Page() {
  const { data } = useLoaderData()
  return <div>{data}</div>
}
```

## Common Tasks

### Add a new page

1. Create a file in `app/routes/`, e.g., `about.tsx`
2. Export a default component
3. Done! Visit `/about`

### Add a new database table

1. Add the SQL in Supabase SQL Editor
2. Add the TypeScript type in `app/lib/database.types.ts`
3. Query it with `supabase.from('table_name').select()`

### Style components

Use Tailwind CSS classes:
```tsx
<button className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700">
  Click me
</button>
```

## Troubleshooting

### "SUPABASE_URL must be set"
Make sure your `.env` file exists and has the correct values.

### "Listing not found" on detail page
The listing ID might not exist. Check your database.

### Messages badge not updating in one browser
Unread counters are server-synced via `/api/unread` with polling fallback. Ensure the user session cookie is valid in that browser.

### 404 page appears for unknown URL
Expected behavior: unknown routes are handled by the catch-all route and return a user-friendly 404 page.

### Auth not working
1. Check Supabase Auth settings
2. Make sure email provider is enabled
3. For Google: check redirect URLs match

### Styles not loading
Run `npm run dev` again - Tailwind might need to rebuild.

## Next Steps

After launching your MVP:

1. **Get feedback** from 5-10 tour operators you know
2. **Track usage** - How many listings? How many messages?
3. **Iterate** based on real user needs

Future features to consider:
- Email notifications for new messages
- Listing expiration/renewal
- Rating system
- Payment integration (Stripe)
- Mobile app (React Native)

## License

MIT - Do whatever you want with it!
