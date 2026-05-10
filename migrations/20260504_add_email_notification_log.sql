CREATE TABLE IF NOT EXISTS public.email_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_notification_log_throttle_idx
  ON public.email_notification_log (recipient_id, conversation_id, template_id, sent_at DESC);

ALTER TABLE public.email_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.email_notification_log
  USING (false);
