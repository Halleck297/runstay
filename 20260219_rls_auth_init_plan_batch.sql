-- Supabase lint fix batch: Auth RLS Initialization Plan
-- Normalizes remaining RLS policies to use (select auth.uid()) instead of auth.uid()
-- so auth context is initialized once per statement, not re-evaluated per row.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversations'
      AND policyname = 'Participants can delete conversations'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Participants can delete conversations"
      ON public.conversations
      USING (
        ((select auth.uid()) = participant_1)
        OR ((select auth.uid()) = participant_2)
      )
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversations'
      AND policyname = 'Participants can view conversations'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Participants can view conversations"
      ON public.conversations
      USING (
        (
          ((select auth.uid()) = participant_1)
          AND (deleted_by_1 = false)
        )
        OR (
          ((select auth.uid()) = participant_2)
          AND (deleted_by_2 = false)
        )
      )
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND policyname = 'Participants can send messages'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Participants can send messages"
      ON public.messages
      WITH CHECK (
        ((select auth.uid()) = sender_id)
        AND EXISTS (
          SELECT 1
          FROM public.conversations c
          WHERE c.id = messages.conversation_id
            AND (
              c.participant_1 = (select auth.uid())
              OR c.participant_2 = (select auth.uid())
            )
        )
      )
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND policyname = 'Recipients can mark messages as read'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Recipients can mark messages as read"
      ON public.messages
      USING (
        EXISTS (
          SELECT 1
          FROM public.conversations c
          WHERE c.id = messages.conversation_id
            AND (
              c.participant_1 = (select auth.uid())
              OR c.participant_2 = (select auth.uid())
            )
        )
      )
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'saved_listings'
      AND policyname = 'Users can save listings'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Users can save listings"
      ON public.saved_listings
      WITH CHECK ((select auth.uid()) = user_id)
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'saved_listings'
      AND policyname = 'Users can unsave listings'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Users can unsave listings"
      ON public.saved_listings
      USING ((select auth.uid()) = user_id)
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'listings'
      AND policyname = 'Users can delete their own listings'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Users can delete their own listings"
      ON public.listings
      USING ((select auth.uid()) = author_id)
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'listings'
      AND policyname = 'Users can insert their own listings'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Users can insert their own listings"
      ON public.listings
      WITH CHECK ((select auth.uid()) = author_id)
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'listings'
      AND policyname = 'Users can read their own listings'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Users can read their own listings"
      ON public.listings
      USING ((select auth.uid()) = author_id)
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'listings'
      AND policyname = 'Users can update their own listings'
  ) THEN
    EXECUTE $sql$
      ALTER POLICY "Users can update their own listings"
      ON public.listings
      USING ((select auth.uid()) = author_id)
      WITH CHECK ((select auth.uid()) = author_id)
    $sql$;
  END IF;
END
$$;
