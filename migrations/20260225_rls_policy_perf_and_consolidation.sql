-- Consolidated RLS cleanup:
-- 1) Replace auth.uid() with (select auth.uid()) for policy init-plan optimization.
-- 2) Remove overlapping permissive SELECT policies on admin_managed_accounts.

-- referral_invites
DROP POLICY IF EXISTS "TLs can view own referral invites" ON public.referral_invites;
CREATE POLICY "TLs can view own referral invites"
  ON public.referral_invites
  FOR SELECT
  TO authenticated
  USING (team_leader_id = (select auth.uid()));

-- event_requests
DROP POLICY IF EXISTS "TL can manage own event requests" ON public.event_requests;
CREATE POLICY "TL can manage own event requests"
  ON public.event_requests
  FOR ALL
  TO authenticated
  USING (team_leader_id = (select auth.uid()))
  WITH CHECK (team_leader_id = (select auth.uid()));

-- event_request_updates
DROP POLICY IF EXISTS "TL can view updates of own requests" ON public.event_request_updates;
CREATE POLICY "TL can view updates of own requests"
  ON public.event_request_updates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.event_requests er
      WHERE er.id = event_request_id
        AND er.team_leader_id = (select auth.uid())
    )
  );

-- admin_managed_accounts
-- Replace SELECT + FOR ALL pair with one SELECT and dedicated write policies.
DROP POLICY IF EXISTS admin_managed_accounts_admin_select ON public.admin_managed_accounts;
DROP POLICY IF EXISTS admin_managed_accounts_admin_write ON public.admin_managed_accounts;
DROP POLICY IF EXISTS admin_managed_accounts_admin_insert ON public.admin_managed_accounts;
DROP POLICY IF EXISTS admin_managed_accounts_admin_update ON public.admin_managed_accounts;
DROP POLICY IF EXISTS admin_managed_accounts_admin_delete ON public.admin_managed_accounts;

CREATE POLICY admin_managed_accounts_admin_select
  ON public.admin_managed_accounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY admin_managed_accounts_admin_insert
  ON public.admin_managed_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY admin_managed_accounts_admin_update
  ON public.admin_managed_accounts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY admin_managed_accounts_admin_delete
  ON public.admin_managed_accounts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.role IN ('admin', 'superadmin')
    )
  );
