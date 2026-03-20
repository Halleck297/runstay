-- Migration: Create RPC function for cross-language event search
-- Searches event name, location, country across base fields AND all i18n translations.
-- This solves the problem where a German user searches "Wien" but the base field says "Vienna".

CREATE OR REPLACE FUNCTION public.search_events_i18n(query TEXT)
RETURNS SETOF public.events
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT e.*
  FROM public.events e
  WHERE
    -- Search base fields
    e.name ILIKE '%' || query || '%'
    OR e.location ILIKE '%' || query || '%'
    OR e.country ILIKE '%' || query || '%'
    -- Search i18n JSON values (name translations)
    OR EXISTS (
      SELECT 1 FROM jsonb_each_text(COALESCE(e.name_i18n::jsonb, '{}'::jsonb)) AS t(k, v)
      WHERE v ILIKE '%' || query || '%'
    )
    -- Search i18n JSON values (location translations)
    OR EXISTS (
      SELECT 1 FROM jsonb_each_text(COALESCE(e.location_i18n::jsonb, '{}'::jsonb)) AS t(k, v)
      WHERE v ILIKE '%' || query || '%'
    )
    -- Search i18n JSON values (country translations)
    OR EXISTS (
      SELECT 1 FROM jsonb_each_text(COALESCE(e.country_i18n::jsonb, '{}'::jsonb)) AS t(k, v)
      WHERE v ILIKE '%' || query || '%'
    )
  ORDER BY e.event_date ASC;
$$;

-- Grant access to authenticated users (needed for Supabase RPC calls)
GRANT EXECUTE ON FUNCTION public.search_events_i18n(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_events_i18n(TEXT) TO anon;
