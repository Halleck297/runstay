-- Track when a user's phone number has been verified via OTP.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
