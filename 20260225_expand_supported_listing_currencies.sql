-- Expand supported listing currencies to match app-level policy.

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'listings'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%currency%'
  LOOP
    EXECUTE format('ALTER TABLE public.listings DROP CONSTRAINT %I', rec.conname);
  END LOOP;
END
$$;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_currency_check
  CHECK (currency IN ('EUR', 'USD', 'GBP', 'JPY', 'CAD', 'CHF', 'AUD'));

