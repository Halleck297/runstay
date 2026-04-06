-- Add invited_full_name column to referral_invites
-- Used by admin invites to optionally pre-fill the user's name in the signup form
ALTER TABLE public.referral_invites
  ADD COLUMN IF NOT EXISTS invited_full_name TEXT;

-- Allow admin_invite as an invite_type value
-- (existing values: new_runner, existing_runner)
-- No constraint change needed if invite_type is TEXT without a check constraint.
