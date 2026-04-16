-- Add city_place_id to profiles and access_requests for Google Places integration
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city_place_id TEXT;
ALTER TABLE public.access_requests ADD COLUMN IF NOT EXISTS city_place_id TEXT;
