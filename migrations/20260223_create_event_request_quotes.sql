-- Quote options for event request workflow (admin proposes, TL selects)

CREATE TABLE IF NOT EXISTS public.event_request_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_request_id uuid NOT NULL REFERENCES public.event_requests(id) ON DELETE CASCADE,
  agency_name text NOT NULL,
  package_title text,
  total_price numeric(10,2) NOT NULL CHECK (total_price >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  summary text,
  includes text,
  excludes text,
  cancellation_policy text,
  payment_terms text,
  valid_until date,
  is_recommended boolean NOT NULL DEFAULT false,
  is_selected boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_request_quotes_request_idx
  ON public.event_request_quotes(event_request_id, is_recommended, total_price);

CREATE UNIQUE INDEX IF NOT EXISTS event_request_quotes_one_selected_idx
  ON public.event_request_quotes(event_request_id)
  WHERE is_selected = true;

ALTER TABLE public.event_requests
  ADD COLUMN IF NOT EXISTS selected_quote_id uuid REFERENCES public.event_request_quotes(id),
  ADD COLUMN IF NOT EXISTS selected_quote_at timestamptz;

