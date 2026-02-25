-- Add missing covering indexes for foreign keys reported by lint (round 3).
-- Safe and idempotent.

CREATE INDEX IF NOT EXISTS idx_tl_invite_tokens_created_by
  ON public.tl_invite_tokens(created_by);

CREATE INDEX IF NOT EXISTS idx_reports_reported_user_id
  ON public.reports(reported_user_id);

CREATE INDEX IF NOT EXISTS idx_reports_reported_listing_id
  ON public.reports(reported_listing_id);

CREATE INDEX IF NOT EXISTS idx_referral_invites_claimed_by
  ON public.referral_invites(claimed_by);

CREATE INDEX IF NOT EXISTS idx_profiles_created_by_admin
  ON public.profiles(created_by_admin);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id
  ON public.messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_event_requests_archived_by
  ON public.event_requests(archived_by);

CREATE INDEX IF NOT EXISTS idx_event_request_updates_actor_id
  ON public.event_request_updates(actor_id);

CREATE INDEX IF NOT EXISTS idx_conversations_participant_2
  ON public.conversations(participant_2);

CREATE INDEX IF NOT EXISTS idx_contact_messages_user_id
  ON public.contact_messages(user_id);
