-- Store legal consent events for registration flows

CREATE TABLE IF NOT EXISTS public.legal_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  access_request_id UUID REFERENCES public.access_requests(id) ON DELETE SET NULL,
  email TEXT,
  source TEXT NOT NULL CHECK (source IN ('join_referral', 'register_request')),
  locale TEXT,
  terms_accepted_at TIMESTAMPTZ NOT NULL,
  privacy_accepted_at TIMESTAMPTZ NOT NULL,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_consents_user ON public.legal_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_consents_access_request ON public.legal_consents(access_request_id);
CREATE INDEX IF NOT EXISTS idx_legal_consents_created_at ON public.legal_consents(created_at DESC);

ALTER TABLE public.legal_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_consents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legal_consents_admin_select ON public.legal_consents;

CREATE POLICY legal_consents_admin_select
ON public.legal_consents
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.user_type IN ('admin', 'superadmin')
  )
);
