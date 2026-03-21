-- Canonical admin-managed account metadata:
-- access_mode drives product behavior and replaces mixed heuristics.
CREATE TABLE IF NOT EXISTS public.admin_managed_accounts (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_mode TEXT NOT NULL CHECK (access_mode IN ('internal_only', 'external_password', 'external_invite')),
  created_by_admin UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_managed_accounts_access_mode
  ON public.admin_managed_accounts(access_mode);

CREATE INDEX IF NOT EXISTS idx_admin_managed_accounts_created_by_admin
  ON public.admin_managed_accounts(created_by_admin);

-- Backfill known mock accounts conservatively as internal_only.
INSERT INTO public.admin_managed_accounts (user_id, access_mode, created_by_admin)
SELECT m.user_id, 'internal_only', p.created_by_admin
FROM public.mock_accounts m
LEFT JOIN public.profiles p ON p.id = m.user_id
ON CONFLICT (user_id) DO NOTHING;
