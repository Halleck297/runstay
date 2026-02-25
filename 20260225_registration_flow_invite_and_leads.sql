-- Registration flow hardening: invite-only signup + lead capture + private DOB

-- 1) Add date_of_birth to profiles private info
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- 2) Lead capture table for request-access flow
CREATE TABLE IF NOT EXISTS public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT,
  city TEXT,
  phone TEXT,
  preferred_language TEXT,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'public_signup' CHECK (source IN ('public_signup', 'contact_form')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Avoid duplicate pending requests by normalized email
CREATE UNIQUE INDEX IF NOT EXISTS idx_access_requests_pending_email_unique
  ON public.access_requests (lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_access_requests_status_created
  ON public.access_requests (status, created_at DESC);

-- Keep updated_at consistent
DROP TRIGGER IF EXISTS set_access_requests_updated_at ON public.access_requests;
CREATE TRIGGER set_access_requests_updated_at
  BEFORE UPDATE ON public.access_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS: admins can read/manage; anyone can create request (insert only)
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS access_requests_admin_select ON public.access_requests;
DROP POLICY IF EXISTS access_requests_admin_insert ON public.access_requests;
DROP POLICY IF EXISTS access_requests_admin_update ON public.access_requests;
DROP POLICY IF EXISTS access_requests_admin_delete ON public.access_requests;
DROP POLICY IF EXISTS access_requests_public_insert ON public.access_requests;

CREATE POLICY access_requests_admin_select
ON public.access_requests
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

CREATE POLICY access_requests_admin_insert
ON public.access_requests
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.user_type IN ('admin', 'superadmin')
  )
);

CREATE POLICY access_requests_admin_update
ON public.access_requests
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.user_type IN ('admin', 'superadmin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.user_type IN ('admin', 'superadmin')
  )
);

CREATE POLICY access_requests_admin_delete
ON public.access_requests
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.user_type IN ('admin', 'superadmin')
  )
);

CREATE POLICY access_requests_public_insert
ON public.access_requests
FOR INSERT
TO public
WITH CHECK (true);
