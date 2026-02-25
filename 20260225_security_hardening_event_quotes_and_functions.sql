-- Security hardening bundle:
-- 1) Enable RLS on event_request_quotes with explicit policies.
-- 2) Lock function search_path for trigger helpers.

-- ---------------------------------------------------------------------------
-- event_request_quotes RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.event_request_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_request_quotes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_request_quotes_tl_or_admin_select ON public.event_request_quotes;
CREATE POLICY event_request_quotes_tl_or_admin_select
  ON public.event_request_quotes
  FOR SELECT
  TO authenticated
  USING (
    -- TL can read quotes of own request
    EXISTS (
      SELECT 1
      FROM public.event_requests er
      WHERE er.id = event_request_quotes.event_request_id
        AND er.team_leader_id = (select auth.uid())
    )
    OR
    -- Admin / superadmin can read all
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS event_request_quotes_admin_insert ON public.event_request_quotes;
CREATE POLICY event_request_quotes_admin_insert
  ON public.event_request_quotes
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

DROP POLICY IF EXISTS event_request_quotes_admin_update ON public.event_request_quotes;
CREATE POLICY event_request_quotes_admin_update
  ON public.event_request_quotes
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

DROP POLICY IF EXISTS event_request_quotes_admin_delete ON public.event_request_quotes;
CREATE POLICY event_request_quotes_admin_delete
  ON public.event_request_quotes
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

-- ---------------------------------------------------------------------------
-- Function search_path hardening
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
