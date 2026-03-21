-- Track mock users in a dedicated table (separate from profiles).
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS public.mock_accounts (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by_admin UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mock_accounts_created_by_admin
  ON public.mock_accounts(created_by_admin);

-- Backfill legacy mock users created before mock_accounts tracking.
-- Legacy pattern: admin-created users with generated mock email domain.
INSERT INTO public.mock_accounts (user_id, created_by_admin)
SELECT p.id, p.created_by_admin
FROM public.profiles p
WHERE p.created_by_admin IS NOT NULL
  AND p.email ILIKE 'mock.%@runoot.test'
  AND NOT EXISTS (
    SELECT 1
    FROM public.mock_accounts m
    WHERE m.user_id = p.id
  );
