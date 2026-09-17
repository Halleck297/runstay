-- Optional contact number for runner availability reports.
alter table public.bib_offers
  add column if not exists phone text check (char_length(phone) between 6 and 40);
