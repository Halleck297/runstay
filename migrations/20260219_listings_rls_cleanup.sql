-- Listings RLS cleanup
-- Removes legacy/duplicate policies and recreates a single coherent policy set.
-- Canonical behavior:
-- 1) Everyone can read only active listings
-- 2) Authenticated users can CRUD only their own listings

-- Remove duplicates / legacy policies
DROP POLICY IF EXISTS "Listings are viewable by everyone" ON public.listings;
DROP POLICY IF EXISTS "Authenticated users can create listings" ON public.listings;
DROP POLICY IF EXISTS "Authors can update own listings" ON public.listings;
DROP POLICY IF EXISTS "Authors can delete own listings" ON public.listings;

DROP POLICY IF EXISTS "Users can read their own listings" ON public.listings;
DROP POLICY IF EXISTS "Users can insert their own listings" ON public.listings;
DROP POLICY IF EXISTS "Users can update their own listings" ON public.listings;
DROP POLICY IF EXISTS "Users can delete their own listings" ON public.listings;
DROP POLICY IF EXISTS "Anyone can read active listings" ON public.listings;

-- Recreate canonical policies
CREATE POLICY "Anyone can read active listings" ON public.listings
  FOR SELECT USING (status = 'active');

CREATE POLICY "Users can read their own listings" ON public.listings
  FOR SELECT USING ((select auth.uid()) = author_id);

CREATE POLICY "Users can insert their own listings" ON public.listings
  FOR INSERT WITH CHECK ((select auth.uid()) = author_id);

CREATE POLICY "Users can update their own listings" ON public.listings
  FOR UPDATE
  USING ((select auth.uid()) = author_id)
  WITH CHECK ((select auth.uid()) = author_id);

CREATE POLICY "Users can delete their own listings" ON public.listings
  FOR DELETE USING ((select auth.uid()) = author_id);
