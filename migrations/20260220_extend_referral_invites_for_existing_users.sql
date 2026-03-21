-- Migration: extend referral_invites for existing-runner team invitations
-- Purpose:
-- 1) distinguish invite intent (new runner signup vs existing runner join-team)
-- 2) store optional TL personal message for existing-runner invites

ALTER TABLE public.referral_invites
  ADD COLUMN IF NOT EXISTS invite_type TEXT NOT NULL DEFAULT 'new_runner'
    CHECK (invite_type IN ('new_runner', 'existing_runner')),
  ADD COLUMN IF NOT EXISTS personal_message TEXT;

CREATE INDEX IF NOT EXISTS idx_referral_invites_team_type_status
  ON public.referral_invites (team_leader_id, invite_type, status, created_at DESC);
