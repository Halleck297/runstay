-- Rollback of index cleanup: restore previously dropped indexes.
-- Use this after running 20260225_targeted_fk_and_unused_indexes.sql
-- when you want to keep optional feature-oriented indexes.

CREATE INDEX IF NOT EXISTS idx_referrals_referred_status
  ON public.referrals(referred_user_id, status);

CREATE INDEX IF NOT EXISTS idx_referral_invites_team_type_status
  ON public.referral_invites(team_leader_id, invite_type, status, created_at DESC);
