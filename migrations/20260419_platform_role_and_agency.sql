-- Migration: introduce platform_role + referred_by_id, rename tour_operator → agency
-- Date: 2026-04-19

-- ============================================================
-- 1. Add platform_role column
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS platform_role TEXT
    CHECK (platform_role IN ('runner', 'ambassador', 'team_leader'));

-- ============================================================
-- 2. Populate platform_role from existing user_type
-- ============================================================
UPDATE public.profiles SET platform_role = 'team_leader' WHERE user_type = 'team_leader';
UPDATE public.profiles SET platform_role = 'runner'      WHERE user_type IN ('private', 'admin', 'superadmin');
-- tour_operator users get NULL platform_role (separate world)

-- ============================================================
-- 3. Add referred_by_id column
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Populate referred_by_id from existing referrals table
-- (team_leader_id is the direct referrer for existing runners)
UPDATE public.profiles p
SET referred_by_id = r.team_leader_id
FROM public.referrals r
WHERE r.referred_user_id = p.id
  AND p.referred_by_id IS NULL;

-- ============================================================
-- 4. Migrate user_type: collapse to agency | private
-- ============================================================
-- Drop old constraint first, then update data
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_type_check;

-- Rename tour_operator → agency (data)
UPDATE public.profiles SET user_type = 'agency' WHERE user_type = 'tour_operator';

-- Collapse team_leader / admin / superadmin → private
UPDATE public.profiles SET user_type = 'private' WHERE user_type IN ('team_leader', 'admin', 'superadmin');

-- ============================================================
-- 5. Add new user_type CHECK constraint
-- ============================================================
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_type_check
    CHECK (user_type IN ('private', 'agency'));

-- ============================================================
-- 6. Add ambassador_invite to referral_invites.invite_type
-- ============================================================
ALTER TABLE public.referral_invites DROP CONSTRAINT IF EXISTS referral_invites_invite_type_check;
ALTER TABLE public.referral_invites
  ADD CONSTRAINT referral_invites_invite_type_check
    CHECK (invite_type IN (
      'new_runner',
      'existing_runner',
      'admin_invite',
      'admin_invite_tl',
      'admin_invite_to',
      'ambassador_invite'
    ));

-- ============================================================
-- 7. Index for fast hierarchy traversal
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by_id
  ON public.profiles(referred_by_id);

CREATE INDEX IF NOT EXISTS idx_profiles_platform_role
  ON public.profiles(platform_role);
