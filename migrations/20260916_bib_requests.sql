-- Standalone requests; existing users, listings and conversations are untouched.
create table if not exists public.bib_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_name text not null check (char_length(first_name) between 1 and 100),
  last_name text not null check (char_length(last_name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254 and email = lower(email)),
  race text not null check (char_length(race) between 2 and 120),
  race_key text not null check (race_key = lower(race)),
  preference text not null check (preference in ('bib', 'package')),
  source text not null check (source in ('qr', 'site')),
  landing_path text not null,
  consent_version text not null,
  consent_text text not null,
  email_verified boolean not null default false,
  unique(email, race_key)
);
create index if not exists bib_requests_created_at_idx on public.bib_requests(created_at desc);
alter table public.bib_requests enable row level security;
revoke all on public.bib_requests from anon, authenticated;
grant select, insert, update, delete on public.bib_requests to service_role;
comment on table public.bib_requests is 'BibExchange opt-in requests. Server-only access; email ownership not verified.';
