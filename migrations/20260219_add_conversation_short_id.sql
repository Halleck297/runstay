-- Add public short_id for conversations to avoid exposing UUID in URLs
-- Safe to run multiple times.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS short_id TEXT
  GENERATED ALWAYS AS (substring(replace(id::text, '-', '') from 1 for 12)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_short_id
  ON public.conversations(short_id);
