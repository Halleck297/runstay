-- ============================================
-- Migration: Soft-delete listings
-- Date: 2026-05-19
-- Description: Adds a terminal deleted status so listing conversations and
--              messages survive when an author/admin removes a listing.
-- ============================================

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_status_check
  CHECK (status IN ('pending', 'active', 'sold', 'expired', 'rejected', 'deleted'));

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_listings_deleted
  ON public.listings(deleted_at DESC)
  WHERE status = 'deleted';
