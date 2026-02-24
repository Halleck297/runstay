-- Separate exchange listings from event listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS listing_mode text;

-- Backfill existing rows conservatively
UPDATE public.listings
SET listing_mode = 'exchange'
WHERE listing_mode IS NULL;

-- Mark listings published from event_requests as event-mode
UPDATE public.listings l
SET listing_mode = 'event'
WHERE EXISTS (
  SELECT 1
  FROM public.event_requests er
  WHERE er.published_listing_url ILIKE '%' || '/listings/' || COALESCE(l.short_id, l.id::text)
);

ALTER TABLE public.listings
  ALTER COLUMN listing_mode SET DEFAULT 'exchange';

ALTER TABLE public.listings
  ALTER COLUMN listing_mode SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'listings_listing_mode_check'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_listing_mode_check
      CHECK (listing_mode IN ('exchange', 'event'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_listings_status_mode_created_at
  ON public.listings (status, listing_mode, created_at DESC);
