-- ============================================
-- Runoot Smoke Check (read-only)
-- Date: 2026-02-19
-- Usage:
--   Run in Supabase SQL Editor after schema/migrations.
--   Returns boolean checks and basic integrity summaries.
-- ============================================

-- 1) Required tables exist
SELECT 'table:profiles' AS check_name,
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='profiles'
       ) AS ok
UNION ALL
SELECT 'table:events',
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='events'
       )
UNION ALL
SELECT 'table:listings',
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='listings'
       )
UNION ALL
SELECT 'table:conversations',
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='conversations'
       )
UNION ALL
SELECT 'table:messages',
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='messages'
       )
UNION ALL
SELECT 'table:saved_listings',
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='saved_listings'
       )
UNION ALL
SELECT 'table:contact_messages',
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='contact_messages'
       )
UNION ALL
SELECT 'table:blocked_users',
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='blocked_users'
       )
UNION ALL
SELECT 'table:reports',
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='reports'
       )
UNION ALL
SELECT 'table:admin_audit_log',
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='admin_audit_log'
       )
UNION ALL
SELECT 'table:referrals',
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='referrals'
       )
UNION ALL
SELECT 'table:notifications',
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='notifications'
       )
UNION ALL
SELECT 'table:tl_invite_tokens',
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='tl_invite_tokens'
       )
ORDER BY check_name;

-- 2) Critical columns exist
SELECT 'column:profiles.role' AS check_name,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='profiles' AND column_name='role'
       ) AS ok
UNION ALL
SELECT 'column:profiles.is_team_leader',
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='profiles' AND column_name='is_team_leader'
       )
UNION ALL
SELECT 'column:listings.reviewed_by',
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='listings' AND column_name='reviewed_by'
       )
UNION ALL
SELECT 'column:listings.status',
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='listings' AND column_name='status'
       )
UNION ALL
SELECT 'column:messages.message_type',
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='messages' AND column_name='message_type'
       )
UNION ALL
SELECT 'column:contact_messages.subject',
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='contact_messages' AND column_name='subject'
       )
ORDER BY check_name;

-- 3) Key constraints/checks present
SELECT 'constraint:profiles_role_check' AS check_name,
       EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conname='profiles_role_check'
           AND conrelid='public.profiles'::regclass
       ) AS ok
UNION ALL
SELECT 'constraint:listings_status_check',
       EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conname='listings_status_check'
           AND conrelid='public.listings'::regclass
       )
UNION ALL
SELECT 'constraint:notifications_type_check',
       EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conname='notifications_type_check'
           AND conrelid='public.notifications'::regclass
       )
ORDER BY check_name;

-- 4) RLS enabled on sensitive tables
SELECT tablename AS table_name, rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'listings', 'conversations', 'messages',
    'saved_listings', 'contact_messages', 'blocked_users',
    'reports', 'admin_audit_log', 'referrals', 'notifications', 'tl_invite_tokens'
  )
ORDER BY tablename;

-- 5) Indexes sanity (optional visibility)
SELECT indexname
FROM pg_indexes
WHERE schemaname='public'
  AND indexname IN (
    'idx_listings_pending',
    'idx_notifications_unread',
    'idx_referrals_team_leader',
    'idx_audit_log_created',
    'idx_blocked_users_blocker'
  )
ORDER BY indexname;
