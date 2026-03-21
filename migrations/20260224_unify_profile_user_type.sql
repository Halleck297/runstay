-- Unify account classification on profiles.user_type
-- Canonical values: private, team_leader, tour_operator, admin, superadmin

BEGIN;

-- 1) Backfill canonical user_type from legacy columns.
UPDATE public.profiles
SET user_type = CASE
  WHEN role = 'superadmin' THEN 'superadmin'
  WHEN role = 'admin' THEN 'admin'
  WHEN is_team_leader IS TRUE THEN 'team_leader'
  WHEN user_type = 'tour_operator' THEN 'tour_operator'
  ELSE 'private'
END;

-- 2) Expand user_type constraint.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_user_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_type_check
  CHECK (user_type IN ('private', 'team_leader', 'tour_operator', 'admin', 'superadmin'));

-- 3) Keep legacy columns aligned during transition.
UPDATE public.profiles
SET
  is_team_leader = (user_type = 'team_leader'),
  role = CASE
    WHEN user_type = 'superadmin' THEN 'superadmin'
    WHEN user_type = 'admin' THEN 'admin'
    ELSE 'user'
  END;

COMMIT;
