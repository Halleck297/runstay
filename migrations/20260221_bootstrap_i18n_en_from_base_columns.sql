-- Bootstrap i18n payloads from existing base columns.
-- Adds/updates only the "en" key when missing/empty, preserving existing translations.

UPDATE public.events
SET name_i18n = COALESCE(name_i18n, '{}'::jsonb) || jsonb_build_object('en', btrim(name))
WHERE name IS NOT NULL
  AND btrim(name) <> ''
  AND COALESCE(name_i18n->>'en', '') = '';

UPDATE public.events
SET location_i18n = COALESCE(location_i18n, '{}'::jsonb) || jsonb_build_object('en', btrim(location))
WHERE location IS NOT NULL
  AND btrim(location) <> ''
  AND COALESCE(location_i18n->>'en', '') = '';

UPDATE public.events
SET country_i18n = COALESCE(country_i18n, '{}'::jsonb) || jsonb_build_object('en', btrim(country))
WHERE country IS NOT NULL
  AND btrim(country) <> ''
  AND COALESCE(country_i18n->>'en', '') = '';

UPDATE public.listings
SET title_i18n = COALESCE(title_i18n, '{}'::jsonb) || jsonb_build_object('en', btrim(title))
WHERE title IS NOT NULL
  AND btrim(title) <> ''
  AND COALESCE(title_i18n->>'en', '') = '';

UPDATE public.listings
SET description_i18n = COALESCE(description_i18n, '{}'::jsonb) || jsonb_build_object('en', btrim(description))
WHERE description IS NOT NULL
  AND btrim(description) <> ''
  AND COALESCE(description_i18n->>'en', '') = '';

UPDATE public.listings
SET hotel_name_i18n = COALESCE(hotel_name_i18n, '{}'::jsonb) || jsonb_build_object('en', btrim(hotel_name))
WHERE hotel_name IS NOT NULL
  AND btrim(hotel_name) <> ''
  AND COALESCE(hotel_name_i18n->>'en', '') = '';

UPDATE public.listings
SET hotel_city_i18n = COALESCE(hotel_city_i18n, '{}'::jsonb) || jsonb_build_object('en', btrim(hotel_city))
WHERE hotel_city IS NOT NULL
  AND btrim(hotel_city) <> ''
  AND COALESCE(hotel_city_i18n->>'en', '') = '';

UPDATE public.listings
SET hotel_country_i18n = COALESCE(hotel_country_i18n, '{}'::jsonb) || jsonb_build_object('en', btrim(hotel_country))
WHERE hotel_country IS NOT NULL
  AND btrim(hotel_country) <> ''
  AND COALESCE(hotel_country_i18n->>'en', '') = '';

UPDATE public.hotels
SET name_i18n = COALESCE(name_i18n, '{}'::jsonb) || jsonb_build_object('en', btrim(name))
WHERE name IS NOT NULL
  AND btrim(name) <> ''
  AND COALESCE(name_i18n->>'en', '') = '';

UPDATE public.hotels
SET city_i18n = COALESCE(city_i18n, '{}'::jsonb) || jsonb_build_object('en', btrim(city))
WHERE city IS NOT NULL
  AND btrim(city) <> ''
  AND COALESCE(city_i18n->>'en', '') = '';

UPDATE public.hotels
SET country_i18n = COALESCE(country_i18n, '{}'::jsonb) || jsonb_build_object('en', btrim(country))
WHERE country IS NOT NULL
  AND btrim(country) <> ''
  AND COALESCE(country_i18n->>'en', '') = '';
