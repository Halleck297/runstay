-- ============================================
-- Migration: Listing Approval Workflow (Phase 3)
-- Date: 2026-02-19
-- Description: Adds 'pending' and 'rejected' statuses to listings,
--              adds admin_note/reviewed_at/reviewed_by columns,
--              and adds new notification types for approval flow.
-- ============================================

-- Run this in Supabase SQL Editor

-- 1. Drop + re-add CHECK constraint on listings.status (add pending + rejected)
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_status_check
  CHECK (status IN ('pending', 'active', 'sold', 'expired', 'rejected'));

-- 2. Change default from 'active' to 'pending'
ALTER TABLE public.listings ALTER COLUMN status SET DEFAULT 'pending';

-- 3. New columns for approval audit trail
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 4. Partial index for fast admin pending queue queries
CREATE INDEX IF NOT EXISTS idx_listings_pending
  ON public.listings(created_at DESC)
  WHERE status = 'pending';

-- 5. Update notifications type CHECK constraint (add listing_approved + listing_rejected)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'referral_signup',
    'referral_active',
    'tl_promoted',
    'system',
    'listing_approved',
    'listing_rejected'
  ));

-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================
