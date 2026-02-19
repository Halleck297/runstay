-- ============================================
-- Migration: Add created_by_admin to profiles
-- Date: 2026-02-13
-- Description: Track which users were created by admin (impersonation only for those)
-- ============================================

-- Run this in Supabase SQL Editor

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_by_admin UUID REFERENCES profiles(id) DEFAULT NULL;
