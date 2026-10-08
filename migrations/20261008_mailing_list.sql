-- Consent and confirmation records; Resend is authoritative for current
-- subscriptions and automatically excludes opt-outs when sending Broadcasts.
create table if not exists public.mailing_list_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and char_length(email) between 3 and 254),
  first_name text not null default '' check (char_length(first_name) <= 100),
  last_name text not null default '' check (char_length(last_name) <= 100),
  source text not null check (source in ('popup', 'admin')),
  consent_text text not null,
  consent_version text not null,
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  token_hash text unique,
  token_expires_at timestamptz,
  added_by uuid references public.profiles(id) on delete set null,
  resend_contact_id text,
  check ((token_hash is null) = (token_expires_at is null))
);
create index if not exists mailing_list_signups_requested_idx on public.mailing_list_signups(requested_at desc);

create table if not exists public.mailing_list_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (char_length(subject) between 1 and 150),
  preview_text text not null default '' check (char_length(preview_text) <= 200),
  body text not null check (char_length(body) between 1 and 20000),
  button_label text not null default '',
  button_url text not null default '',
  state text not null default 'draft' check (state in ('draft', 'preparing', 'ready', 'sending', 'submitted')),
  resend_broadcast_id text unique,
  last_error text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  send_requested_at timestamptz,
  check (state not in ('ready', 'sending', 'submitted') or resend_broadcast_id is not null)
);
create index if not exists mailing_list_campaigns_created_idx on public.mailing_list_campaigns(created_at desc);

alter table public.mailing_list_signups enable row level security;
alter table public.mailing_list_campaigns enable row level security;
revoke all on public.mailing_list_signups, public.mailing_list_campaigns from anon, authenticated;
grant select, insert, update, delete on public.mailing_list_signups, public.mailing_list_campaigns to service_role;
comment on table public.mailing_list_signups is 'Server-only consent history and single-use confirmation tokens. Confirmed does not mean currently subscribed: consult Resend.';
