-- Private availability reports, reviewed manually before any matching.
create table if not exists public.bib_offers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_name text not null check (char_length(first_name) between 1 and 100),
  last_name text not null check (char_length(last_name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254 and email = lower(email)),
  race text not null check (char_length(race) between 2 and 120),
  race_date date not null,
  entry_type text not null check (entry_type in ('bib', 'package')),
  transfer_status text not null check (transfer_status in ('official_transfer', 'unknown')),
  deadline date check (deadline <= race_date),
  price numeric(12,2) check (price between 0 and 100000),
  currency text not null check (currency in ('EUR', 'GBP', 'USD', 'JPY', 'AUD', 'CAD', 'ZAR')),
  notes text check (char_length(notes) <= 2000),
  consent_version text not null,
  consent_text text not null
);
create index if not exists bib_offers_created_at_idx on public.bib_offers(created_at desc);
alter table public.bib_offers enable row level security;
revoke all on public.bib_offers from anon, authenticated;
grant select, insert, update, delete on public.bib_offers to service_role;
comment on table public.bib_offers is 'Private, unverified availability reports; no automatic listing or transfer approval.';
