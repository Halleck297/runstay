-- Track unread/read state for event request conversation

ALTER TABLE public.event_requests
  ADD COLUMN IF NOT EXISTS tl_last_seen_update_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_last_seen_update_at timestamptz;

