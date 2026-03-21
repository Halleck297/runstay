-- Weekly FX snapshot storage + precomputed listing prices by currency.

CREATE TABLE IF NOT EXISTS public.fx_rates (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  effective_at timestamptz NOT NULL DEFAULT now(),
  rates jsonb NOT NULL,
  source text
);

CREATE INDEX IF NOT EXISTS idx_fx_rates_effective_at_desc
  ON public.fx_rates (effective_at DESC);

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fx_rates_admin_select ON public.fx_rates;
CREATE POLICY fx_rates_admin_select
  ON public.fx_rates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.user_type IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS fx_rates_admin_write ON public.fx_rates;
CREATE POLICY fx_rates_admin_write
  ON public.fx_rates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.user_type IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (select auth.uid())
        AND p.user_type IN ('admin', 'superadmin')
    )
  );

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS price_converted jsonb;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS associated_costs_converted jsonb;

INSERT INTO public.fx_rates (effective_at, rates, source)
SELECT
  now(),
  jsonb_build_object(
    'EUR', 1.08,
    'USD', 1.0,
    'GBP', 1.27,
    'JPY', 0.0067,
    'CAD', 0.74,
    'CHF', 1.12,
    'AUD', 0.65
  ),
  'default_seed'
WHERE NOT EXISTS (SELECT 1 FROM public.fx_rates);
