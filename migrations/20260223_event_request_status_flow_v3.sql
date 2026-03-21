-- Finalize event request statuses (remove legacy states)
-- New flow:
-- under_review -> quoting -> changes_requested -> approved -> scheduled -> published
-- rejected remains terminal

-- 1) Normalize legacy statuses already stored in DB
UPDATE public.event_requests
SET status = 'under_review'
WHERE status IN ('submitted', 'draft_submitted', 'event_submitted_for_review', 'agency_confirmation_pending');

UPDATE public.event_requests
SET status = 'approved'
WHERE status = 'approved_for_event_draft';

UPDATE public.event_requests
SET status = 'changes_requested'
WHERE status = 'awaiting_tl_decision';

UPDATE public.event_requests
SET status = 'quoting'
WHERE status = 'quotes_received';

UPDATE public.event_requests
SET status = 'published'
WHERE status = 'closed';

-- 2) Drop previous status check constraint (name may vary)
DO $$
DECLARE
  status_check_name TEXT;
BEGIN
  SELECT c.conname
  INTO status_check_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'event_requests'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%';

  IF status_check_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.event_requests DROP CONSTRAINT %I', status_check_name);
  END IF;
END $$;

-- 3) Set new default + enforce only new statuses
ALTER TABLE public.event_requests
  ALTER COLUMN status SET DEFAULT 'under_review';

ALTER TABLE public.event_requests
  ADD CONSTRAINT event_requests_status_check
  CHECK (
    status IN (
      'under_review',
      'quoting',
      'changes_requested',
      'approved',
      'scheduled',
      'rejected',
      'published'
    )
  );
