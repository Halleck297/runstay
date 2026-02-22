-- Split profile language concerns:
-- - preferred_language: UI locale preference
-- - languages_spoken: human languages spoken by user / operator

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'preferred_language'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN preferred_language text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'languages'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'languages_spoken'
  ) THEN
    ALTER TABLE public.profiles
      RENAME COLUMN languages TO languages_spoken;
  END IF;
END $$;

-- Normalize pre-existing preferred_language values (if already present)
UPDATE public.profiles
SET preferred_language = lower(split_part(btrim(preferred_language), '-', 1))
WHERE preferred_language IS NOT NULL
  AND btrim(preferred_language) <> '';

-- Infer preferred_language for legacy rows from languages_spoken if empty
WITH inferred AS (
  SELECT
    p.id,
    (
      SELECT lower(split_part(token, '-', 1))
      FROM regexp_split_to_table(COALESCE(p.languages_spoken, ''), '[,\\s;|/]+') AS token
      WHERE lower(split_part(token, '-', 1)) IN ('en', 'de', 'fr', 'it', 'es', 'nl', 'pt')
      LIMIT 1
    ) AS locale
  FROM public.profiles p
  WHERE p.preferred_language IS NULL OR btrim(p.preferred_language) = ''
)
UPDATE public.profiles p
SET preferred_language = inferred.locale
FROM inferred
WHERE p.id = inferred.id
  AND inferred.locale IS NOT NULL;

-- Drop invalid values to keep the field clean
UPDATE public.profiles
SET preferred_language = NULL
WHERE preferred_language IS NOT NULL
  AND preferred_language NOT IN ('en', 'de', 'fr', 'it', 'es', 'nl', 'pt');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_preferred_language_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_preferred_language_check
      CHECK (
        preferred_language IS NULL OR
        preferred_language IN ('en', 'de', 'fr', 'it', 'es', 'nl', 'pt')
      );
  END IF;
END $$;
