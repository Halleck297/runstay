-- Update event request flow statuses:
-- submitted -> quoting -> approved_for_event_draft -> draft_submitted -> published

UPDATE public.event_requests
SET status = 'approved_for_event_draft'
WHERE status = 'awaiting_tl_decision';

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

ALTER TABLE public.event_requests
  ADD CONSTRAINT event_requests_status_check
  CHECK (
    status IN (
      'submitted',
      'quoting',
      'approved_for_event_draft',
      'draft_submitted',
      'published'
    )
  );
