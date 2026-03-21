-- Listings SELECT RLS cleanup:
-- - remove anon/public read policy
-- - avoid multiple permissive SELECT policies
-- - keep marketplace visibility for authenticated users

DROP POLICY IF EXISTS "Anyone can read active listings" ON public.listings;
DROP POLICY IF EXISTS "Users can read their own listings" ON public.listings;
DROP POLICY IF EXISTS "Authenticated users can read active listings" ON public.listings;

CREATE POLICY "Authenticated users can read active listings" ON public.listings
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    OR (select auth.uid()) = author_id
  );
