-- Add missing covering indexes for admin_audit_log foreign keys.
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_listing_id
  ON public.admin_audit_log(target_listing_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_id
  ON public.admin_audit_log(target_user_id);

-- Ensure tl_invite_tokens has explicit RLS policies.
ALTER TABLE IF EXISTS public.tl_invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tl_invite_tokens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tl_invite_tokens_admin_select ON public.tl_invite_tokens;
DROP POLICY IF EXISTS tl_invite_tokens_admin_insert ON public.tl_invite_tokens;
DROP POLICY IF EXISTS tl_invite_tokens_admin_update ON public.tl_invite_tokens;
DROP POLICY IF EXISTS tl_invite_tokens_admin_delete ON public.tl_invite_tokens;

CREATE POLICY tl_invite_tokens_admin_select
ON public.tl_invite_tokens
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.user_type = 'TO'
  )
);

CREATE POLICY tl_invite_tokens_admin_insert
ON public.tl_invite_tokens
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.user_type = 'TO'
  )
);

CREATE POLICY tl_invite_tokens_admin_update
ON public.tl_invite_tokens
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.user_type = 'TO'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.user_type = 'TO'
  )
);

CREATE POLICY tl_invite_tokens_admin_delete
ON public.tl_invite_tokens
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.user_type = 'TO'
  )
);

-- If agency_tokens exists in target DB, make RLS explicit with admin-only policies.
DO $$
BEGIN
  IF to_regclass('public.agency_tokens') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.agency_tokens ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.agency_tokens FORCE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS agency_tokens_admin_select ON public.agency_tokens';
    EXECUTE 'DROP POLICY IF EXISTS agency_tokens_admin_insert ON public.agency_tokens';
    EXECUTE 'DROP POLICY IF EXISTS agency_tokens_admin_update ON public.agency_tokens';
    EXECUTE 'DROP POLICY IF EXISTS agency_tokens_admin_delete ON public.agency_tokens';

    EXECUTE '
      CREATE POLICY agency_tokens_admin_select
      ON public.agency_tokens
      FOR SELECT
      TO public
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = (SELECT auth.uid())
            AND p.user_type = ''TO''
        )
      )
    ';

    EXECUTE '
      CREATE POLICY agency_tokens_admin_insert
      ON public.agency_tokens
      FOR INSERT
      TO public
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = (SELECT auth.uid())
            AND p.user_type = ''TO''
        )
      )
    ';

    EXECUTE '
      CREATE POLICY agency_tokens_admin_update
      ON public.agency_tokens
      FOR UPDATE
      TO public
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = (SELECT auth.uid())
            AND p.user_type = ''TO''
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = (SELECT auth.uid())
            AND p.user_type = ''TO''
        )
      )
    ';

    EXECUTE '
      CREATE POLICY agency_tokens_admin_delete
      ON public.agency_tokens
      FOR DELETE
      TO public
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = (SELECT auth.uid())
            AND p.user_type = ''TO''
        )
      )
    ';
  END IF;
END $$;
