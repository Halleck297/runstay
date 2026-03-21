-- Migration: Add referral_slug, team_join_requests table, and invite tokens
-- Date: 2026-03-21

-- Add referral_slug to profiles (human-friendly slug like "mario-rossi")
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_slug TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_referral_slug ON public.profiles(referral_slug);

-- Create team_join_requests table
CREATE TABLE IF NOT EXISTS public.team_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tl_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_team_join_requests_tl ON public.team_join_requests(tl_id);
CREATE INDEX IF NOT EXISTS idx_team_join_requests_status ON public.team_join_requests(tl_id, status);
ALTER TABLE public.team_join_requests ENABLE ROW LEVEL SECURITY;

-- Add token column to referral_invites
ALTER TABLE public.referral_invites ADD COLUMN IF NOT EXISTS token TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_referral_invites_token ON public.referral_invites(token);
