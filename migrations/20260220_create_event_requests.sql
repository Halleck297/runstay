-- Event Requests flow (Team Leader -> Superadmin -> Publish)

CREATE TABLE IF NOT EXISTS public.event_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_leader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (
    status IN (
      'submitted',
      'quoting',
      'quotes_received',
      'awaiting_tl_decision',
      'approved_for_event_draft',
      'event_submitted_for_review',
      'agency_confirmation_pending',
      'published',
      'closed'
    )
  ),
  event_name TEXT NOT NULL,
  event_location TEXT NOT NULL,
  event_date DATE NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('bib', 'hotel', 'package')),
  people_count INTEGER NOT NULL CHECK (people_count > 0),
  notes TEXT,
  desired_deadline DATE,
  quote_summary TEXT,
  selected_agency_name TEXT,
  tl_event_details TEXT,
  published_listing_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_requests_team_leader
  ON public.event_requests (team_leader_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_requests_status
  ON public.event_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.event_request_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_request_id UUID NOT NULL REFERENCES public.event_requests(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_request_updates_request
  ON public.event_request_updates (event_request_id, created_at DESC);

ALTER TABLE public.event_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_request_updates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_requests'
      AND policyname = 'TL can manage own event requests'
  ) THEN
    CREATE POLICY "TL can manage own event requests"
      ON public.event_requests
      FOR ALL
      USING (team_leader_id = auth.uid())
      WITH CHECK (team_leader_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_request_updates'
      AND policyname = 'TL can view updates of own requests'
  ) THEN
    CREATE POLICY "TL can view updates of own requests"
      ON public.event_request_updates
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.event_requests er
          WHERE er.id = event_request_id
            AND er.team_leader_id = auth.uid()
        )
      );
  END IF;
END $$;
