-- =====================================================
-- Migration: Add Missing Listing Fields
-- Data: 2026-01-16
-- Descrizione: Aggiunge campi hotel e room mancanti
--              alla tabella listings
-- =====================================================

-- 1. Aggiungere campi hotel da Google Places
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS hotel_website TEXT,
ADD COLUMN IF NOT EXISTS hotel_place_id TEXT,
ADD COLUMN IF NOT EXISTS hotel_city TEXT,
ADD COLUMN IF NOT EXISTS hotel_country TEXT,
ADD COLUMN IF NOT EXISTS hotel_lat DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS hotel_lng DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS hotel_rating DECIMAL(3, 2);

-- 2. Aggiungere campo room_type
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS room_type TEXT
CHECK (room_type IN (
  'single', 
  'twin', 
  'double', 
  'twin_shared', 
  'double_single_use', 
  'triple', 
  'quadruple'
));

-- 3. Creare indici per campi searchable
CREATE INDEX IF NOT EXISTS idx_listings_hotel_city ON public.listings(hotel_city);
CREATE INDEX IF NOT EXISTS idx_listings_hotel_country ON public.listings(hotel_country);
CREATE INDEX IF NOT EXISTS idx_listings_room_type ON public.listings(room_type);

-- 4. Aggiungere commenti per documentazione
COMMENT ON COLUMN public.listings.hotel_website IS 'Hotel website URL from Google Places or manual entry';
COMMENT ON COLUMN public.listings.hotel_place_id IS 'Google Places API unique identifier';
COMMENT ON COLUMN public.listings.hotel_city IS 'Hotel city (from Google Places or manual)';
COMMENT ON COLUMN public.listings.hotel_country IS 'Hotel country (from Google Places or manual)';
COMMENT ON COLUMN public.listings.hotel_lat IS 'Hotel latitude coordinate';
COMMENT ON COLUMN public.listings.hotel_lng IS 'Hotel longitude coordinate';
COMMENT ON COLUMN public.listings.hotel_rating IS 'Google Places rating (1.0 to 5.0)';
COMMENT ON COLUMN public.listings.room_type IS 'Type of room offered (single, double, twin, etc.)';

-- 5. Verificare la migration
DO $$
DECLARE
  missing_columns TEXT[];
  expected_columns TEXT[] := ARRAY[
    'hotel_website', 'hotel_place_id', 'hotel_city', 'hotel_country',
    'hotel_lat', 'hotel_lng', 'hotel_rating', 'room_type'
  ];
  col TEXT;
BEGIN
  -- Check if all columns exist
  FOREACH col IN ARRAY expected_columns
  LOOP
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'listings' 
        AND column_name = col
    ) THEN
      missing_columns := array_append(missing_columns, col);
    END IF;
  END LOOP;
  
  IF array_length(missing_columns, 1) IS NULL THEN
    RAISE NOTICE '✅ Migration completed successfully! All 8 columns added.';
  ELSE
    RAISE WARNING '⚠️  Missing columns: %', array_to_string(missing_columns, ', ');
  END IF;
END $$;
