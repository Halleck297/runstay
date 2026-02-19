-- Fix Supabase lint: Auth RLS Initialization Plan on public.profiles
-- Avoid per-row re-evaluation by wrapping auth.uid() in a scalar subquery.

ALTER POLICY "Users can update own profile"
ON public.profiles
USING ((select auth.uid()) = id);

ALTER POLICY "Users can insert own profile"
ON public.profiles
WITH CHECK ((select auth.uid()) = id);
