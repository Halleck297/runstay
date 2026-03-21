ALTER TABLE public.event_requests
  ADD COLUMN IF NOT EXISTS internal_admin_note TEXT;
