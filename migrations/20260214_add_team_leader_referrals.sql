-- ============================================
-- Migration: Team Leader + Referral System
-- Date: 2026-02-14
-- Description: Adds TL flag, referral codes, referrals tracking,
--              notifications, and TL invite tokens
-- ============================================

-- 1. Add Team Leader fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_team_leader BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tl_welcome_message TEXT;

-- Index for referral code lookup (used on /join/:code)
CREATE INDEX IF NOT EXISTS idx_profiles_team_leader
  ON profiles(is_team_leader) WHERE is_team_leader = TRUE;

-- 2. Referrals tracking table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_leader_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code_used TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered', 'active')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_team_leader ON referrals(team_leader_id);
CREATE INDEX IF NOT EXISTS idx_referrals_created ON referrals(created_at DESC);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TLs can view own referrals" ON referrals
  FOR SELECT USING (team_leader_id = auth.uid());

-- 3. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('referral_signup', 'referral_active', 'tl_promoted', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- 4. TL Invite Tokens table
CREATE TABLE IF NOT EXISTS public.tl_invite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  used_by UUID REFERENCES profiles(id),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tl_invite_token ON tl_invite_tokens(token);

ALTER TABLE tl_invite_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================
