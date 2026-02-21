-- Add public short_id for profiles and listings (same style as conversations)
-- Safe to run multiple times.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS short_id TEXT
  GENERATED ALWAYS AS (substring(replace(id::text, '-', '') from 1 for 12)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_short_id
  ON public.profiles(short_id);

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS short_id TEXT
  GENERATED ALWAYS AS (substring(replace(id::text, '-', '') from 1 for 12)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_short_id
  ON public.listings(short_id);
