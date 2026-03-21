-- Add first-class archive fields for admin soft delete
ALTER TABLE public.event_requests
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS archived_by uuid NULL;

-- Optional FK (kept nullable and set null if admin profile is removed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_requests_archived_by_fkey'
  ) THEN
    ALTER TABLE public.event_requests
      ADD CONSTRAINT event_requests_archived_by_fkey
      FOREIGN KEY (archived_by)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill old marker-based archives into structured columns
UPDATE public.event_requests
SET archived_at = COALESCE(archived_at, updated_at)
WHERE archived_at IS NULL
  AND internal_admin_note IS NOT NULL
  AND internal_admin_note LIKE '[ARCHIVED]%';
