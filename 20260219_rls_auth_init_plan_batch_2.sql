-- Supabase lint fix batch #2: Auth RLS Initialization Plan
-- Idempotent updates for policy variants currently in use.

DO $$
BEGIN
  -- hotels
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hotels'
      AND policyname = 'Authenticated users can create hotels'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Authenticated users can create hotels"
      ON public.hotels
      WITH CHECK ((select auth.uid()) IS NOT NULL)
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hotels'
      AND policyname = 'Service role can insert hotels'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Service role can insert hotels"
      ON public.hotels
      WITH CHECK ((select auth.role()) = 'service_role')
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hotels'
      AND policyname = 'Service role can update hotels'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Service role can update hotels"
      ON public.hotels
      USING ((select auth.role()) = 'service_role')
      WITH CHECK ((select auth.role()) = 'service_role')
    $sql$;
  END IF;

  -- blocked_users (name variants)
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'blocked_users'
      AND policyname = 'Users can view own blocked users'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Users can view own blocked users"
      ON public.blocked_users
      USING ((select auth.uid()) = blocker_id)
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'blocked_users'
      AND policyname = 'Users can view own blocks'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Users can view own blocks"
      ON public.blocked_users
      USING ((select auth.uid()) = blocker_id)
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'blocked_users'
      AND policyname = 'Users can block users'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Users can block users"
      ON public.blocked_users
      WITH CHECK ((select auth.uid()) = blocker_id)
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'blocked_users'
      AND policyname = 'Users can block others'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Users can block others"
      ON public.blocked_users
      WITH CHECK ((select auth.uid()) = blocker_id)
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'blocked_users'
      AND policyname = 'Users can unblock users'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Users can unblock users"
      ON public.blocked_users
      USING ((select auth.uid()) = blocker_id)
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'blocked_users'
      AND policyname = 'Users can unblock others'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Users can unblock others"
      ON public.blocked_users
      USING ((select auth.uid()) = blocker_id)
    $sql$;
  END IF;

  -- reports
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reports'
      AND policyname = 'Users can view own reports'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Users can view own reports"
      ON public.reports
      USING ((select auth.uid()) = reporter_id)
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reports'
      AND policyname = 'Users can create reports'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Users can create reports"
      ON public.reports
      WITH CHECK ((select auth.uid()) = reporter_id)
    $sql$;
  END IF;
END
$$;
