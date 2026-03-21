-- Migration: Add referral_invites table for email-based TL ownership
-- Purpose: TL can reserve lead emails; ownership is enforced even without referral link

CREATE TABLE IF NOT EXISTS public.referral_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_leader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  claimed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_invites_email_unique
  ON public.referral_invites (lower(email));

CREATE INDEX IF NOT EXISTS idx_referral_invites_team_leader
  ON public.referral_invites (team_leader_id, created_at DESC);

ALTER TABLE public.referral_invites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'referral_invites'
      AND policyname = 'TLs can view own referral invites'
  ) THEN
    CREATE POLICY "TLs can view own referral invites"
      ON public.referral_invites FOR SELECT
      USING (team_leader_id = auth.uid());
  END IF;
END $$;
