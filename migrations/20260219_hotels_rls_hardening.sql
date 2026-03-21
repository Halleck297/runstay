-- Harden hotels RLS policies for service_role writes
-- Safe to run multiple times

ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can insert hotels" ON public.hotels;
DROP POLICY IF EXISTS "Service role can update hotels" ON public.hotels;

CREATE POLICY "Service role can insert hotels" ON public.hotels
  FOR INSERT TO service_role
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update hotels" ON public.hotels
  FOR UPDATE TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
