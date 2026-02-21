-- i18n content storage for localized UI/content fields
-- Keep base columns as fallback, and store per-locale values in JSONB maps
-- Example: {"en":"Berlin Marathon","de":"Berlin-Marathon","fr":"Marathon de Berlin"}

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS name_i18n JSONB,
  ADD COLUMN IF NOT EXISTS location_i18n JSONB,
  ADD COLUMN IF NOT EXISTS country_i18n JSONB;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS title_i18n JSONB,
  ADD COLUMN IF NOT EXISTS description_i18n JSONB,
  ADD COLUMN IF NOT EXISTS hotel_name_i18n JSONB,
  ADD COLUMN IF NOT EXISTS hotel_city_i18n JSONB,
  ADD COLUMN IF NOT EXISTS hotel_country_i18n JSONB;

ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS name_i18n JSONB,
  ADD COLUMN IF NOT EXISTS city_i18n JSONB,
  ADD COLUMN IF NOT EXISTS country_i18n JSONB;

-- Optional: basic GIN indexes for lookup/filter scenarios on i18n blobs
CREATE INDEX IF NOT EXISTS idx_events_name_i18n_gin ON public.events USING GIN (name_i18n);
CREATE INDEX IF NOT EXISTS idx_events_location_i18n_gin ON public.events USING GIN (location_i18n);
CREATE INDEX IF NOT EXISTS idx_events_country_i18n_gin ON public.events USING GIN (country_i18n);

CREATE INDEX IF NOT EXISTS idx_listings_title_i18n_gin ON public.listings USING GIN (title_i18n);
CREATE INDEX IF NOT EXISTS idx_listings_hotel_city_i18n_gin ON public.listings USING GIN (hotel_city_i18n);
CREATE INDEX IF NOT EXISTS idx_listings_hotel_country_i18n_gin ON public.listings USING GIN (hotel_country_i18n);

CREATE INDEX IF NOT EXISTS idx_hotels_name_i18n_gin ON public.hotels USING GIN (name_i18n);
CREATE INDEX IF NOT EXISTS idx_hotels_city_i18n_gin ON public.hotels USING GIN (city_i18n);
CREATE INDEX IF NOT EXISTS idx_hotels_country_i18n_gin ON public.hotels USING GIN (country_i18n);
