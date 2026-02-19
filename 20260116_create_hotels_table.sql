-- =====================================================
-- Migration: Create Hotels Table
-- Data: 2026-01-16
-- Descrizione: Crea tabella hotels separata per 
--              normalizzare i dati degli hotel
-- =====================================================

-- 1. Creare tabella hotels
CREATE TABLE IF NOT EXISTS public.hotels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  place_id TEXT UNIQUE,
  name TEXT NOT NULL,
  city TEXT,
  country TEXT,
  website TEXT,
  lat DECIMAL(10, 7),
  lng DECIMAL(10, 7),
  rating DECIMAL(3, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Aggiungere colonna hotel_id alla tabella listings
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES public.hotels(id) ON DELETE SET NULL;

-- 3. Indici per performance
CREATE INDEX IF NOT EXISTS idx_hotels_place_id ON public.hotels(place_id);
CREATE INDEX IF NOT EXISTS idx_hotels_city ON public.hotels(city);
CREATE INDEX IF NOT EXISTS idx_hotels_country ON public.hotels(country);
CREATE INDEX IF NOT EXISTS idx_listings_hotel ON public.listings(hotel_id);

-- 4. Row Level Security
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;

-- Tutti possono leggere gli hotel
CREATE POLICY "Hotels are viewable by everyone" ON public.hotels
  FOR SELECT USING (true);

-- Solo service role può creare/modificare (via supabaseAdmin)
CREATE POLICY "Service role can insert hotels" ON public.hotels
  FOR INSERT TO service_role
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update hotels" ON public.hotels
  FOR UPDATE TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 5. Trigger per updated_at
CREATE TRIGGER on_hotels_updated
  BEFORE UPDATE ON public.hotels
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. Commenti per documentazione
COMMENT ON TABLE public.hotels IS 'Hotels database from Google Places API or manual entry';
COMMENT ON COLUMN public.hotels.place_id IS 'Google Places API unique identifier (nullable for manual entries)';
COMMENT ON COLUMN public.hotels.lat IS 'Latitude coordinate';
COMMENT ON COLUMN public.hotels.lng IS 'Longitude coordinate';
COMMENT ON COLUMN public.hotels.rating IS 'Google rating from 1.0 to 5.0';

-- 7. Verifica migrazione
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Hotels table created: %', (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hotels'));
  RAISE NOTICE 'hotel_id column added to listings: %', (SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'hotel_id'));
END $$;
