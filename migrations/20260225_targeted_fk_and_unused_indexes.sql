-- Targeted index maintenance from Supabase lint findings:
-- 1) Add missing covering index for tl_invite_tokens.used_by FK.
-- 2) Drop indexes flagged as unused.

-- Unindexed foreign key: tl_invite_tokens_used_by_fkey
CREATE INDEX IF NOT EXISTS idx_tl_invite_tokens_used_by
  ON public.tl_invite_tokens(used_by);

-- Unused indexes (reported by lint):
DROP INDEX IF EXISTS public.idx_referrals_referred_status;
DROP INDEX IF EXISTS public.idx_referral_invites_team_type_status;
