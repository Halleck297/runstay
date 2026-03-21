-- ============================================
-- Migration: Add Admin Role + Audit Log
-- Date: 2026-02-13
-- Description: Adds role column to profiles and creates admin_audit_log table
-- ============================================

-- 1. Add role column to profiles
ALTER TABLE profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin', 'superadmin'));

-- 2. Create admin audit log table
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES profiles(id),
  target_listing_id UUID REFERENCES listings(id),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for audit log
CREATE INDEX idx_audit_log_admin ON admin_audit_log(admin_id);
CREATE INDEX idx_audit_log_created ON admin_audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON admin_audit_log(action);

-- 4. Enable RLS on audit log
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for audit log
-- Only admins/superadmins can read
CREATE POLICY "Admins can read audit log"
  ON admin_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Service role (supabaseAdmin) can insert - no policy needed as it bypasses RLS
-- But we add one for safety if ever used with regular client
CREATE POLICY "Admins can insert audit log"
  ON admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- 6. Add index on profiles.role for fast admin checks
CREATE INDEX idx_profiles_role ON profiles(role);

-- ============================================
-- MANUAL STEP AFTER MIGRATION:
-- Set your own profile as superadmin:
-- UPDATE profiles SET role = 'superadmin' WHERE email = 'your-email@example.com';
-- ============================================
