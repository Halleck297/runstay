-- Migration: referral activity lifecycle based on last login
-- Rules:
-- - registered: default state
-- - active: set on login after registration
-- - inactive: if no login for 15+ days

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

DO $$
DECLARE
  referrals_status_check_name TEXT;
BEGIN
  SELECT c.conname
  INTO referrals_status_check_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'referrals'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%';

  IF referrals_status_check_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.referrals DROP CONSTRAINT %I', referrals_status_check_name);
  END IF;
END $$;

ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_status_check
  CHECK (status IN ('registered', 'active', 'inactive'));

CREATE INDEX IF NOT EXISTS idx_referrals_referred_status
  ON public.referrals (referred_user_id, status);
