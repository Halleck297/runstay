-- Extend invite_type check constraint to allow admin invite types
ALTER TABLE public.referral_invites
  DROP CONSTRAINT IF EXISTS referral_invites_invite_type_check;

ALTER TABLE public.referral_invites
  ADD CONSTRAINT referral_invites_invite_type_check
    CHECK (invite_type IN ('new_runner', 'existing_runner', 'admin_invite', 'admin_invite_tl', 'admin_invite_to'));
