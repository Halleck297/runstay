-- Add missing covering indexes for foreign keys reported by lint.
-- Safe and idempotent.

CREATE INDEX IF NOT EXISTS idx_event_requests_selected_quote_id
  ON public.event_requests(selected_quote_id);

CREATE INDEX IF NOT EXISTS idx_listings_reviewed_by
  ON public.listings(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_events_created_by
  ON public.events(created_by);
