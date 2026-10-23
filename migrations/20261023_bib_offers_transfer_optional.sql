-- The offer form no longer asks how the entry will be transferred; following the
-- organizer's rules is up to seller and buyer. Older rows keep their value.
alter table public.bib_offers alter column transfer_status drop not null;
