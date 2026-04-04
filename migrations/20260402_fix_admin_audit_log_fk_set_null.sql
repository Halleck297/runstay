-- Fix admin_audit_log FKs: use SET NULL so audit records survive user/listing deletion.
-- The JSONB "details" column preserves historical context (names, IDs, etc.).

-- 1. admin_id: drop NOT NULL + replace FK with ON DELETE SET NULL
ALTER TABLE public.admin_audit_log ALTER COLUMN admin_id DROP NOT NULL;
ALTER TABLE public.admin_audit_log DROP CONSTRAINT admin_audit_log_admin_id_fkey;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. target_user_id: replace FK with ON DELETE SET NULL
ALTER TABLE public.admin_audit_log DROP CONSTRAINT admin_audit_log_target_user_id_fkey;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_target_user_id_fkey
  FOREIGN KEY (target_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. target_listing_id: replace FK with ON DELETE SET NULL
ALTER TABLE public.admin_audit_log DROP CONSTRAINT admin_audit_log_target_listing_id_fkey;
ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_target_listing_id_fkey
  FOREIGN KEY (target_listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;
