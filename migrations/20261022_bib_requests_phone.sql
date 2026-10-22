-- Optional WhatsApp number for last-minute race request opportunities.
alter table public.bib_requests
  add column if not exists phone text check (char_length(phone) between 6 and 40);
