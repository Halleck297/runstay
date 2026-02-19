-- ============================================
-- Runoot Admin Repair (Idempotent)
-- Date: 2026-02-19
-- Purpose:
--   - Ensure all DB objects required by /admin exist
--   - Safe to run multiple times
-- ============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1) profiles: role + team leader fields
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_role_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('user', 'admin', 'superadmin'));
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_team_leader BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS tl_welcome_message TEXT,
  ADD COLUMN IF NOT EXISTS created_by_admin UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_referral_code_key'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_referral_code_key UNIQUE (referral_code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_team_leader
  ON public.profiles(is_team_leader) WHERE is_team_leader = TRUE;

-- ============================================
-- 2) admin audit log
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES public.profiles(id),
  target_listing_id UUID REFERENCES public.listings(id),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON public.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.admin_audit_log(action);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_audit_log'
      AND policyname = 'Admins can read audit log'
  ) THEN
    CREATE POLICY "Admins can read audit log"
      ON public.admin_audit_log FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE public.profiles.id = auth.uid()
            AND public.profiles.role IN ('admin', 'superadmin')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_audit_log'
      AND policyname = 'Admins can insert audit log'
  ) THEN
    CREATE POLICY "Admins can insert audit log"
      ON public.admin_audit_log FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE public.profiles.id = auth.uid()
            AND public.profiles.role IN ('admin', 'superadmin')
        )
      );
  END IF;
END $$;

-- ============================================
-- 3) team leader system
-- ============================================

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_leader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code_used TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered', 'active')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_team_leader ON public.referrals(team_leader_id);
CREATE INDEX IF NOT EXISTS idx_referrals_created ON public.referrals(created_at DESC);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'referrals'
      AND policyname = 'TLs can view own referrals'
  ) THEN
    CREATE POLICY "TLs can view own referrals"
      ON public.referrals FOR SELECT
      USING (team_leader_id = auth.uid());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'referral_signup',
      'referral_active',
      'tl_promoted',
      'system',
      'listing_approved',
      'listing_rejected'
    ));
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Users can view own notifications'
  ) THEN
    CREATE POLICY "Users can view own notifications"
      ON public.notifications FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Users can update own notifications'
  ) THEN
    CREATE POLICY "Users can update own notifications"
      ON public.notifications FOR UPDATE
      USING (user_id = auth.uid());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tl_invite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  used_by UUID REFERENCES public.profiles(id),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tl_invite_token ON public.tl_invite_tokens(token);
ALTER TABLE public.tl_invite_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4) listing approval fields
-- ============================================

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS admin_note TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.listings
  ALTER COLUMN status SET DEFAULT 'pending';

DO $$
BEGIN
  ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_status_check;
  ALTER TABLE public.listings
    ADD CONSTRAINT listings_status_check
    CHECK (status IN ('pending', 'active', 'sold', 'expired', 'rejected'));
END $$;

CREATE INDEX IF NOT EXISTS idx_listings_pending
  ON public.listings(created_at DESC)
  WHERE status = 'pending';

-- ============================================
-- 5) final sanity output
-- ============================================

SELECT 'profiles.role exists' AS check_name,
       EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema='public' AND table_name='profiles' AND column_name='role'
       ) AS ok
UNION ALL
SELECT 'profiles.is_team_leader exists',
       EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema='public' AND table_name='profiles' AND column_name='is_team_leader'
       )
UNION ALL
SELECT 'referrals table exists',
       EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema='public' AND table_name='referrals'
       )
UNION ALL
SELECT 'notifications table exists',
       EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema='public' AND table_name='notifications'
       )
UNION ALL
SELECT 'admin_audit_log table exists',
       EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema='public' AND table_name='admin_audit_log'
       )
UNION ALL
SELECT 'listings.reviewed_by exists',
       EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema='public' AND table_name='listings' AND column_name='reviewed_by'
       );

-- Manual step (run once with your email):
-- UPDATE public.profiles SET role='superadmin' WHERE email='your-email@example.com';
