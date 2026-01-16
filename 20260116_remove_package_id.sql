-- =====================================================
-- Migration: Remove package_id field
-- Data: 2026-01-16
-- Descrizione: Rimuove package_id dalla tabella listings
--              perché non necessario per MVP
-- =====================================================

-- 1. Rimuovere colonna package_id
ALTER TABLE public.listings
DROP COLUMN IF EXISTS package_id;

-- 2. Verifica
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'listings' 
      AND column_name = 'package_id'
  ) THEN
    RAISE NOTICE '✅ package_id removed successfully';
  ELSE
    RAISE WARNING '⚠️ package_id still exists';
  END IF;
END $$;
