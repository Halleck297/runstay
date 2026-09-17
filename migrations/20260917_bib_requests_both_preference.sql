-- Allow interest in either offer type without changing existing requests.
begin;
alter table public.bib_requests drop constraint if exists bib_requests_preference_check;
alter table public.bib_requests add constraint bib_requests_preference_check
  check (preference in ('bib', 'package', 'both'));
commit;
