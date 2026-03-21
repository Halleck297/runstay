-- Add image support for Team Leader event requests + public event card image

ALTER TABLE public.event_requests
  ADD COLUMN IF NOT EXISTS event_image_url text,
  ADD COLUMN IF NOT EXISTS event_image_path text;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS card_image_url text;

