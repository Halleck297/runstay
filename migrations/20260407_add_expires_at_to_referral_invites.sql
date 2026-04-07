-- Add expires_at column to referral_invites
-- Invite tokens expire 24h after creation/resend
ALTER TABLE public.referral_invites
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
