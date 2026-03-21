-- Bootstrap IT/DE/FR/ES i18n values from existing EN values.
-- Fills only missing keys and never overwrites existing translations.

-- =========================
-- EVENTS
-- =========================
UPDATE public.events
SET name_i18n = COALESCE(name_i18n, '{}'::jsonb)
  || jsonb_build_object('it', COALESCE(NULLIF(name_i18n->>'en',''), btrim(name)))
  || jsonb_build_object('de', COALESCE(NULLIF(name_i18n->>'en',''), btrim(name)))
  || jsonb_build_object('fr', COALESCE(NULLIF(name_i18n->>'en',''), btrim(name)))
  || jsonb_build_object('es', COALESCE(NULLIF(name_i18n->>'en',''), btrim(name)))
WHERE COALESCE(NULLIF(name_i18n->>'en',''), btrim(name)) IS NOT NULL
  AND COALESCE(NULLIF(name_i18n->>'en',''), btrim(name)) <> ''
  AND (
    COALESCE(name_i18n->>'it','') = ''
    OR COALESCE(name_i18n->>'de','') = ''
    OR COALESCE(name_i18n->>'fr','') = ''
    OR COALESCE(name_i18n->>'es','') = ''
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='events' AND column_name='location'
  ) THEN
    UPDATE public.events
    SET location_i18n = COALESCE(location_i18n, '{}'::jsonb)
      || jsonb_build_object('it', COALESCE(NULLIF(location_i18n->>'en',''), btrim(location)))
      || jsonb_build_object('de', COALESCE(NULLIF(location_i18n->>'en',''), btrim(location)))
      || jsonb_build_object('fr', COALESCE(NULLIF(location_i18n->>'en',''), btrim(location)))
      || jsonb_build_object('es', COALESCE(NULLIF(location_i18n->>'en',''), btrim(location)))
    WHERE COALESCE(NULLIF(location_i18n->>'en',''), btrim(location)) IS NOT NULL
      AND COALESCE(NULLIF(location_i18n->>'en',''), btrim(location)) <> ''
      AND (
        COALESCE(location_i18n->>'it','') = ''
        OR COALESCE(location_i18n->>'de','') = ''
        OR COALESCE(location_i18n->>'fr','') = ''
        OR COALESCE(location_i18n->>'es','') = ''
      );
  END IF;
END $$;

UPDATE public.events
SET country_i18n = COALESCE(country_i18n, '{}'::jsonb)
  || jsonb_build_object('it', COALESCE(NULLIF(country_i18n->>'en',''), btrim(country)))
  || jsonb_build_object('de', COALESCE(NULLIF(country_i18n->>'en',''), btrim(country)))
  || jsonb_build_object('fr', COALESCE(NULLIF(country_i18n->>'en',''), btrim(country)))
  || jsonb_build_object('es', COALESCE(NULLIF(country_i18n->>'en',''), btrim(country)))
WHERE COALESCE(NULLIF(country_i18n->>'en',''), btrim(country)) IS NOT NULL
  AND COALESCE(NULLIF(country_i18n->>'en',''), btrim(country)) <> ''
  AND (
    COALESCE(country_i18n->>'it','') = ''
    OR COALESCE(country_i18n->>'de','') = ''
    OR COALESCE(country_i18n->>'fr','') = ''
    OR COALESCE(country_i18n->>'es','') = ''
  );

-- =========================
-- LISTINGS
-- =========================
UPDATE public.listings
SET title_i18n = COALESCE(title_i18n, '{}'::jsonb)
  || jsonb_build_object('it', COALESCE(NULLIF(title_i18n->>'en',''), btrim(title)))
  || jsonb_build_object('de', COALESCE(NULLIF(title_i18n->>'en',''), btrim(title)))
  || jsonb_build_object('fr', COALESCE(NULLIF(title_i18n->>'en',''), btrim(title)))
  || jsonb_build_object('es', COALESCE(NULLIF(title_i18n->>'en',''), btrim(title)))
WHERE COALESCE(NULLIF(title_i18n->>'en',''), btrim(title)) IS NOT NULL
  AND COALESCE(NULLIF(title_i18n->>'en',''), btrim(title)) <> ''
  AND (
    COALESCE(title_i18n->>'it','') = ''
    OR COALESCE(title_i18n->>'de','') = ''
    OR COALESCE(title_i18n->>'fr','') = ''
    OR COALESCE(title_i18n->>'es','') = ''
  );

UPDATE public.listings
SET description_i18n = COALESCE(description_i18n, '{}'::jsonb)
  || jsonb_build_object('it', COALESCE(NULLIF(description_i18n->>'en',''), btrim(description)))
  || jsonb_build_object('de', COALESCE(NULLIF(description_i18n->>'en',''), btrim(description)))
  || jsonb_build_object('fr', COALESCE(NULLIF(description_i18n->>'en',''), btrim(description)))
  || jsonb_build_object('es', COALESCE(NULLIF(description_i18n->>'en',''), btrim(description)))
WHERE COALESCE(NULLIF(description_i18n->>'en',''), btrim(description)) IS NOT NULL
  AND COALESCE(NULLIF(description_i18n->>'en',''), btrim(description)) <> ''
  AND (
    COALESCE(description_i18n->>'it','') = ''
    OR COALESCE(description_i18n->>'de','') = ''
    OR COALESCE(description_i18n->>'fr','') = ''
    OR COALESCE(description_i18n->>'es','') = ''
  );

UPDATE public.listings
SET hotel_name_i18n = COALESCE(hotel_name_i18n, '{}'::jsonb)
  || jsonb_build_object('it', COALESCE(NULLIF(hotel_name_i18n->>'en',''), btrim(hotel_name)))
  || jsonb_build_object('de', COALESCE(NULLIF(hotel_name_i18n->>'en',''), btrim(hotel_name)))
  || jsonb_build_object('fr', COALESCE(NULLIF(hotel_name_i18n->>'en',''), btrim(hotel_name)))
  || jsonb_build_object('es', COALESCE(NULLIF(hotel_name_i18n->>'en',''), btrim(hotel_name)))
WHERE COALESCE(NULLIF(hotel_name_i18n->>'en',''), btrim(hotel_name)) IS NOT NULL
  AND COALESCE(NULLIF(hotel_name_i18n->>'en',''), btrim(hotel_name)) <> ''
  AND (
    COALESCE(hotel_name_i18n->>'it','') = ''
    OR COALESCE(hotel_name_i18n->>'de','') = ''
    OR COALESCE(hotel_name_i18n->>'fr','') = ''
    OR COALESCE(hotel_name_i18n->>'es','') = ''
  );

UPDATE public.listings
SET hotel_city_i18n = COALESCE(hotel_city_i18n, '{}'::jsonb)
  || jsonb_build_object('it', COALESCE(NULLIF(hotel_city_i18n->>'en',''), btrim(hotel_city)))
  || jsonb_build_object('de', COALESCE(NULLIF(hotel_city_i18n->>'en',''), btrim(hotel_city)))
  || jsonb_build_object('fr', COALESCE(NULLIF(hotel_city_i18n->>'en',''), btrim(hotel_city)))
  || jsonb_build_object('es', COALESCE(NULLIF(hotel_city_i18n->>'en',''), btrim(hotel_city)))
WHERE COALESCE(NULLIF(hotel_city_i18n->>'en',''), btrim(hotel_city)) IS NOT NULL
  AND COALESCE(NULLIF(hotel_city_i18n->>'en',''), btrim(hotel_city)) <> ''
  AND (
    COALESCE(hotel_city_i18n->>'it','') = ''
    OR COALESCE(hotel_city_i18n->>'de','') = ''
    OR COALESCE(hotel_city_i18n->>'fr','') = ''
    OR COALESCE(hotel_city_i18n->>'es','') = ''
  );

UPDATE public.listings
SET hotel_country_i18n = COALESCE(hotel_country_i18n, '{}'::jsonb)
  || jsonb_build_object('it', COALESCE(NULLIF(hotel_country_i18n->>'en',''), btrim(hotel_country)))
  || jsonb_build_object('de', COALESCE(NULLIF(hotel_country_i18n->>'en',''), btrim(hotel_country)))
  || jsonb_build_object('fr', COALESCE(NULLIF(hotel_country_i18n->>'en',''), btrim(hotel_country)))
  || jsonb_build_object('es', COALESCE(NULLIF(hotel_country_i18n->>'en',''), btrim(hotel_country)))
WHERE COALESCE(NULLIF(hotel_country_i18n->>'en',''), btrim(hotel_country)) IS NOT NULL
  AND COALESCE(NULLIF(hotel_country_i18n->>'en',''), btrim(hotel_country)) <> ''
  AND (
    COALESCE(hotel_country_i18n->>'it','') = ''
    OR COALESCE(hotel_country_i18n->>'de','') = ''
    OR COALESCE(hotel_country_i18n->>'fr','') = ''
    OR COALESCE(hotel_country_i18n->>'es','') = ''
  );

-- =========================
-- HOTELS
-- =========================
UPDATE public.hotels
SET name_i18n = COALESCE(name_i18n, '{}'::jsonb)
  || jsonb_build_object('it', COALESCE(NULLIF(name_i18n->>'en',''), btrim(name)))
  || jsonb_build_object('de', COALESCE(NULLIF(name_i18n->>'en',''), btrim(name)))
  || jsonb_build_object('fr', COALESCE(NULLIF(name_i18n->>'en',''), btrim(name)))
  || jsonb_build_object('es', COALESCE(NULLIF(name_i18n->>'en',''), btrim(name)))
WHERE COALESCE(NULLIF(name_i18n->>'en',''), btrim(name)) IS NOT NULL
  AND COALESCE(NULLIF(name_i18n->>'en',''), btrim(name)) <> ''
  AND (
    COALESCE(name_i18n->>'it','') = ''
    OR COALESCE(name_i18n->>'de','') = ''
    OR COALESCE(name_i18n->>'fr','') = ''
    OR COALESCE(name_i18n->>'es','') = ''
  );

UPDATE public.hotels
SET city_i18n = COALESCE(city_i18n, '{}'::jsonb)
  || jsonb_build_object('it', COALESCE(NULLIF(city_i18n->>'en',''), btrim(city)))
  || jsonb_build_object('de', COALESCE(NULLIF(city_i18n->>'en',''), btrim(city)))
  || jsonb_build_object('fr', COALESCE(NULLIF(city_i18n->>'en',''), btrim(city)))
  || jsonb_build_object('es', COALESCE(NULLIF(city_i18n->>'en',''), btrim(city)))
WHERE COALESCE(NULLIF(city_i18n->>'en',''), btrim(city)) IS NOT NULL
  AND COALESCE(NULLIF(city_i18n->>'en',''), btrim(city)) <> ''
  AND (
    COALESCE(city_i18n->>'it','') = ''
    OR COALESCE(city_i18n->>'de','') = ''
    OR COALESCE(city_i18n->>'fr','') = ''
    OR COALESCE(city_i18n->>'es','') = ''
  );

UPDATE public.hotels
SET country_i18n = COALESCE(country_i18n, '{}'::jsonb)
  || jsonb_build_object('it', COALESCE(NULLIF(country_i18n->>'en',''), btrim(country)))
  || jsonb_build_object('de', COALESCE(NULLIF(country_i18n->>'en',''), btrim(country)))
  || jsonb_build_object('fr', COALESCE(NULLIF(country_i18n->>'en',''), btrim(country)))
  || jsonb_build_object('es', COALESCE(NULLIF(country_i18n->>'en',''), btrim(country)))
WHERE COALESCE(NULLIF(country_i18n->>'en',''), btrim(country)) IS NOT NULL
  AND COALESCE(NULLIF(country_i18n->>'en',''), btrim(country)) <> ''
  AND (
    COALESCE(country_i18n->>'it','') = ''
    OR COALESCE(country_i18n->>'de','') = ''
    OR COALESCE(country_i18n->>'fr','') = ''
    OR COALESCE(country_i18n->>'es','') = ''
  );
