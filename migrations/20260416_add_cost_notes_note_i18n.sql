-- Add i18n column for cost_notes free-text note (Google Translate at creation/edit time)
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS cost_notes_note_i18n JSONB;
