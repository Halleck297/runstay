-- Security hardening: admin_managed_accounts is in public schema, so enable RLS.
-- Keep access restricted to admin/superadmin JWT users.

ALTER TABLE public.admin_managed_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_managed_accounts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_managed_accounts_admin_select ON public.admin_managed_accounts;
CREATE POLICY admin_managed_accounts_admin_select
  ON public.admin_managed_accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS admin_managed_accounts_admin_write ON public.admin_managed_accounts;
CREATE POLICY admin_managed_accounts_admin_write
  ON public.admin_managed_accounts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'superadmin')
    )
  );
