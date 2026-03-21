-- Add DOB to access requests so admin approval can carry it into profiles

ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

