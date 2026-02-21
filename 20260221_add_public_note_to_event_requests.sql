ALTER TABLE public.event_requests
ADD COLUMN IF NOT EXISTS public_note TEXT;
