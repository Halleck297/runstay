-- Bootstrap NL/PT i18n values from existing EN values.
-- It fills only missing nl/pt keys and never overwrites existing translations.

-- =====================================================
-- EVENTS
-- =====================================================
UPDATE public.events
SET name_i18n = jsonb_set(
  COALESCE(name_i18n, '{}'::jsonb),
  '{nl}',
  to_jsonb(COALESCE(NULLIF(name_i18n->>'en', ''), btrim(name))),
  true
)
WHERE COALESCE(name_i18n->>'nl', '') = ''
  AND COALESCE(NULLIF(name_i18n->>'en', ''), btrim(name)) IS NOT NULL
  AND COALESCE(NULLIF(name_i18n->>'en', ''), btrim(name)) <> '';

UPDATE public.events
SET name_i18n = jsonb_set(
  COALESCE(name_i18n, '{}'::jsonb),
  '{pt}',
  to_jsonb(COALESCE(NULLIF(name_i18n->>'en', ''), btrim(name))),
  true
)
WHERE COALESCE(name_i18n->>'pt', '') = ''
  AND COALESCE(NULLIF(name_i18n->>'en', ''), btrim(name)) IS NOT NULL
  AND COALESCE(NULLIF(name_i18n->>'en', ''), btrim(name)) <> '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'location'
  ) THEN
    UPDATE public.events
    SET location_i18n = jsonb_set(
      COALESCE(location_i18n, '{}'::jsonb),
      '{nl}',
      to_jsonb(COALESCE(NULLIF(location_i18n->>'en', ''), btrim(location))),
      true
    )
    WHERE COALESCE(location_i18n->>'nl', '') = ''
      AND COALESCE(NULLIF(location_i18n->>'en', ''), btrim(location)) IS NOT NULL
      AND COALESCE(NULLIF(location_i18n->>'en', ''), btrim(location)) <> '';

    UPDATE public.events
    SET location_i18n = jsonb_set(
      COALESCE(location_i18n, '{}'::jsonb),
      '{pt}',
      to_jsonb(COALESCE(NULLIF(location_i18n->>'en', ''), btrim(location))),
      true
    )
    WHERE COALESCE(location_i18n->>'pt', '') = ''
      AND COALESCE(NULLIF(location_i18n->>'en', ''), btrim(location)) IS NOT NULL
      AND COALESCE(NULLIF(location_i18n->>'en', ''), btrim(location)) <> '';
  END IF;
END $$;

UPDATE public.events
SET country_i18n = jsonb_set(
  COALESCE(country_i18n, '{}'::jsonb),
  '{nl}',
  to_jsonb(COALESCE(NULLIF(country_i18n->>'en', ''), btrim(country))),
  true
)
WHERE COALESCE(country_i18n->>'nl', '') = ''
  AND COALESCE(NULLIF(country_i18n->>'en', ''), btrim(country)) IS NOT NULL
  AND COALESCE(NULLIF(country_i18n->>'en', ''), btrim(country)) <> '';

UPDATE public.events
SET country_i18n = jsonb_set(
  COALESCE(country_i18n, '{}'::jsonb),
  '{pt}',
  to_jsonb(COALESCE(NULLIF(country_i18n->>'en', ''), btrim(country))),
  true
)
WHERE COALESCE(country_i18n->>'pt', '') = ''
  AND COALESCE(NULLIF(country_i18n->>'en', ''), btrim(country)) IS NOT NULL
  AND COALESCE(NULLIF(country_i18n->>'en', ''), btrim(country)) <> '';

-- =====================================================
-- LISTINGS
-- =====================================================
UPDATE public.listings
SET title_i18n = jsonb_set(
  COALESCE(title_i18n, '{}'::jsonb),
  '{nl}',
  to_jsonb(COALESCE(NULLIF(title_i18n->>'en', ''), btrim(title))),
  true
)
WHERE COALESCE(title_i18n->>'nl', '') = ''
  AND COALESCE(NULLIF(title_i18n->>'en', ''), btrim(title)) IS NOT NULL
  AND COALESCE(NULLIF(title_i18n->>'en', ''), btrim(title)) <> '';

UPDATE public.listings
SET title_i18n = jsonb_set(
  COALESCE(title_i18n, '{}'::jsonb),
  '{pt}',
  to_jsonb(COALESCE(NULLIF(title_i18n->>'en', ''), btrim(title))),
  true
)
WHERE COALESCE(title_i18n->>'pt', '') = ''
  AND COALESCE(NULLIF(title_i18n->>'en', ''), btrim(title)) IS NOT NULL
  AND COALESCE(NULLIF(title_i18n->>'en', ''), btrim(title)) <> '';

UPDATE public.listings
SET description_i18n = jsonb_set(
  COALESCE(description_i18n, '{}'::jsonb),
  '{nl}',
  to_jsonb(COALESCE(NULLIF(description_i18n->>'en', ''), btrim(description))),
  true
)
WHERE COALESCE(description_i18n->>'nl', '') = ''
  AND COALESCE(NULLIF(description_i18n->>'en', ''), btrim(description)) IS NOT NULL
  AND COALESCE(NULLIF(description_i18n->>'en', ''), btrim(description)) <> '';

UPDATE public.listings
SET description_i18n = jsonb_set(
  COALESCE(description_i18n, '{}'::jsonb),
  '{pt}',
  to_jsonb(COALESCE(NULLIF(description_i18n->>'en', ''), btrim(description))),
  true
)
WHERE COALESCE(description_i18n->>'pt', '') = ''
  AND COALESCE(NULLIF(description_i18n->>'en', ''), btrim(description)) IS NOT NULL
  AND COALESCE(NULLIF(description_i18n->>'en', ''), btrim(description)) <> '';

UPDATE public.listings
SET hotel_name_i18n = jsonb_set(
  COALESCE(hotel_name_i18n, '{}'::jsonb),
  '{nl}',
  to_jsonb(COALESCE(NULLIF(hotel_name_i18n->>'en', ''), btrim(hotel_name))),
  true
)
WHERE COALESCE(hotel_name_i18n->>'nl', '') = ''
  AND COALESCE(NULLIF(hotel_name_i18n->>'en', ''), btrim(hotel_name)) IS NOT NULL
  AND COALESCE(NULLIF(hotel_name_i18n->>'en', ''), btrim(hotel_name)) <> '';

UPDATE public.listings
SET hotel_name_i18n = jsonb_set(
  COALESCE(hotel_name_i18n, '{}'::jsonb),
  '{pt}',
  to_jsonb(COALESCE(NULLIF(hotel_name_i18n->>'en', ''), btrim(hotel_name))),
  true
)
WHERE COALESCE(hotel_name_i18n->>'pt', '') = ''
  AND COALESCE(NULLIF(hotel_name_i18n->>'en', ''), btrim(hotel_name)) IS NOT NULL
  AND COALESCE(NULLIF(hotel_name_i18n->>'en', ''), btrim(hotel_name)) <> '';

UPDATE public.listings
SET hotel_city_i18n = jsonb_set(
  COALESCE(hotel_city_i18n, '{}'::jsonb),
  '{nl}',
  to_jsonb(COALESCE(NULLIF(hotel_city_i18n->>'en', ''), btrim(hotel_city))),
  true
)
WHERE COALESCE(hotel_city_i18n->>'nl', '') = ''
  AND COALESCE(NULLIF(hotel_city_i18n->>'en', ''), btrim(hotel_city)) IS NOT NULL
  AND COALESCE(NULLIF(hotel_city_i18n->>'en', ''), btrim(hotel_city)) <> '';

UPDATE public.listings
SET hotel_city_i18n = jsonb_set(
  COALESCE(hotel_city_i18n, '{}'::jsonb),
  '{pt}',
  to_jsonb(COALESCE(NULLIF(hotel_city_i18n->>'en', ''), btrim(hotel_city))),
  true
)
WHERE COALESCE(hotel_city_i18n->>'pt', '') = ''
  AND COALESCE(NULLIF(hotel_city_i18n->>'en', ''), btrim(hotel_city)) IS NOT NULL
  AND COALESCE(NULLIF(hotel_city_i18n->>'en', ''), btrim(hotel_city)) <> '';

UPDATE public.listings
SET hotel_country_i18n = jsonb_set(
  COALESCE(hotel_country_i18n, '{}'::jsonb),
  '{nl}',
  to_jsonb(COALESCE(NULLIF(hotel_country_i18n->>'en', ''), btrim(hotel_country))),
  true
)
WHERE COALESCE(hotel_country_i18n->>'nl', '') = ''
  AND COALESCE(NULLIF(hotel_country_i18n->>'en', ''), btrim(hotel_country)) IS NOT NULL
  AND COALESCE(NULLIF(hotel_country_i18n->>'en', ''), btrim(hotel_country)) <> '';

UPDATE public.listings
SET hotel_country_i18n = jsonb_set(
  COALESCE(hotel_country_i18n, '{}'::jsonb),
  '{pt}',
  to_jsonb(COALESCE(NULLIF(hotel_country_i18n->>'en', ''), btrim(hotel_country))),
  true
)
WHERE COALESCE(hotel_country_i18n->>'pt', '') = ''
  AND COALESCE(NULLIF(hotel_country_i18n->>'en', ''), btrim(hotel_country)) IS NOT NULL
  AND COALESCE(NULLIF(hotel_country_i18n->>'en', ''), btrim(hotel_country)) <> '';

-- =====================================================
-- HOTELS
-- =====================================================
UPDATE public.hotels
SET name_i18n = jsonb_set(
  COALESCE(name_i18n, '{}'::jsonb),
  '{nl}',
  to_jsonb(COALESCE(NULLIF(name_i18n->>'en', ''), btrim(name))),
  true
)
WHERE COALESCE(name_i18n->>'nl', '') = ''
  AND COALESCE(NULLIF(name_i18n->>'en', ''), btrim(name)) IS NOT NULL
  AND COALESCE(NULLIF(name_i18n->>'en', ''), btrim(name)) <> '';

UPDATE public.hotels
SET name_i18n = jsonb_set(
  COALESCE(name_i18n, '{}'::jsonb),
  '{pt}',
  to_jsonb(COALESCE(NULLIF(name_i18n->>'en', ''), btrim(name))),
  true
)
WHERE COALESCE(name_i18n->>'pt', '') = ''
  AND COALESCE(NULLIF(name_i18n->>'en', ''), btrim(name)) IS NOT NULL
  AND COALESCE(NULLIF(name_i18n->>'en', ''), btrim(name)) <> '';

UPDATE public.hotels
SET city_i18n = jsonb_set(
  COALESCE(city_i18n, '{}'::jsonb),
  '{nl}',
  to_jsonb(COALESCE(NULLIF(city_i18n->>'en', ''), btrim(city))),
  true
)
WHERE COALESCE(city_i18n->>'nl', '') = ''
  AND COALESCE(NULLIF(city_i18n->>'en', ''), btrim(city)) IS NOT NULL
  AND COALESCE(NULLIF(city_i18n->>'en', ''), btrim(city)) <> '';

UPDATE public.hotels
SET city_i18n = jsonb_set(
  COALESCE(city_i18n, '{}'::jsonb),
  '{pt}',
  to_jsonb(COALESCE(NULLIF(city_i18n->>'en', ''), btrim(city))),
  true
)
WHERE COALESCE(city_i18n->>'pt', '') = ''
  AND COALESCE(NULLIF(city_i18n->>'en', ''), btrim(city)) IS NOT NULL
  AND COALESCE(NULLIF(city_i18n->>'en', ''), btrim(city)) <> '';

UPDATE public.hotels
SET country_i18n = jsonb_set(
  COALESCE(country_i18n, '{}'::jsonb),
  '{nl}',
  to_jsonb(COALESCE(NULLIF(country_i18n->>'en', ''), btrim(country))),
  true
)
WHERE COALESCE(country_i18n->>'nl', '') = ''
  AND COALESCE(NULLIF(country_i18n->>'en', ''), btrim(country)) IS NOT NULL
  AND COALESCE(NULLIF(country_i18n->>'en', ''), btrim(country)) <> '';

UPDATE public.hotels
SET country_i18n = jsonb_set(
  COALESCE(country_i18n, '{}'::jsonb),
  '{pt}',
  to_jsonb(COALESCE(NULLIF(country_i18n->>'en', ''), btrim(country))),
  true
)
WHERE COALESCE(country_i18n->>'pt', '') = ''
  AND COALESCE(NULLIF(country_i18n->>'en', ''), btrim(country)) IS NOT NULL
  AND COALESCE(NULLIF(country_i18n->>'en', ''), btrim(country)) <> '';
