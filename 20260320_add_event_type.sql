-- Migration: Add event_type column to events table
-- Distinguishes public marathons from private events (retreats, custom TO events, etc.)

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'marathon';

-- All existing events are assumed to be marathons (the original purpose of the table).
-- Private events created via admin going forward will be explicitly set to 'private'.

-- Optional: if you know the IDs of private/test events, update them manually:
-- UPDATE public.events SET event_type = 'private' WHERE name IN ('prova flow', 'Test Event');
