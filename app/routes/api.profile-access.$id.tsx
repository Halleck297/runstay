import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { getUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { applyProfilePublicIdFilter } from "~/lib/publicIds";
import { isAdmin } from "~/lib/user-access";

type AccessMode = "internal_only" | "external_password" | "external_invite" | null;

export async function loader({ request, params }: LoaderFunctionArgs) {
  const actor = await getUser(request);
  const actorId = (actor as any)?.id as string | undefined;
  const userIsAdmin = !!actor && isAdmin(actor as any);
  const profilePublicId = params.id;

  if (!profilePublicId) {
    return data(
      {
        ok: false,
        code: "missing_profile_id",
        message: "Missing profile id in route param",
      },
      { status: 400 },
    );
  }

  // Try full profile first; if schema is behind, fallback to a smaller projection.
  const fullQuery = supabaseAdmin
    .from("profiles")
    .select(
      "id, short_id, full_name, company_name, user_type, is_verified, public_profile_enabled, public_show_personal_info, public_show_experience, public_show_social",
    );

  const { data: fullProfile, error: fullError } = await applyProfilePublicIdFilter(
    fullQuery as any,
    profilePublicId,
  ).maybeSingle();

  let profile = fullProfile as any;
  let projection = "full" as "full" | "fallback";
  let projectionError: string | null = null;

  if (!profile && fullError) {
    const fallbackQuery = supabaseAdmin
      .from("profiles")
      .select("id, short_id, full_name, company_name, user_type, is_verified, public_profile_enabled");

    const { data: fallbackProfile, error: fallbackError } = await applyProfilePublicIdFilter(
      fallbackQuery as any,
      profilePublicId,
    ).maybeSingle();

    if (fallbackProfile) {
      profile = {
        ...fallbackProfile,
        public_show_personal_info: true,
        public_show_experience: true,
        public_show_social: true,
      };
      projection = "fallback";
      projectionError = fullError.message || null;
    } else {
      projectionError = fallbackError?.message || fullError.message || null;
    }
  }

  if (!profile) {
    return data(
      {
        ok: false,
        code: "profile_not_found",
        profilePublicId,
        projection,
        projectionError,
        actor: {
          authenticated: !!actor,
          actorId: actorId || null,
          userIsAdmin,
        },
      },
      { status: 200 },
    );
  }

  const { data: managedRow } = await (supabaseAdmin as any)
    .from("admin_managed_accounts")
    .select("access_mode, created_by_admin")
    .eq("user_id", profile.id)
    .maybeSingle();

  const accessMode = (managedRow?.access_mode as AccessMode) || null;
  const isInternalOnly = accessMode === "internal_only";
  const isMock = accessMode === "internal_only" || accessMode === "external_password";
  const isOwner = !!actorId && actorId === profile.id;
  const isAlwaysPublicRole = profile.user_type === "tour_operator" || profile.user_type === "team_leader";

  // Mirrors current app behavior (listing link + profile loader):
  const publicProfileEnabled = profile.public_profile_enabled !== false;
  const visibilityRulePass = isAlwaysPublicRole || publicProfileEnabled || isOwner || userIsAdmin;
  const canOpenPublicProfile = !isInternalOnly && visibilityRulePass;

  const denyReasons: string[] = [];
  if (isInternalOnly) denyReasons.push("internal_only_mock");
  if (!isInternalOnly && !visibilityRulePass) denyReasons.push("privacy_blocked");

  return data({
    ok: true,
    profilePublicId,
    projection,
    projectionError,
    actor: {
      authenticated: !!actor,
      actorId: actorId || null,
      userIsAdmin,
      isOwner,
    },
    profile: {
      id: profile.id,
      short_id: profile.short_id || null,
      full_name: profile.full_name || null,
      user_type: profile.user_type,
      is_verified: !!profile.is_verified,
      public_profile_enabled: profile.public_profile_enabled !== false,
      public_show_personal_info: profile.public_show_personal_info !== false,
      public_show_experience: profile.public_show_experience !== false,
      public_show_social: profile.public_show_social !== false,
    },
    adminManaged: {
      access_mode: accessMode,
      created_by_admin: (managedRow as any)?.created_by_admin || null,
      is_mock: isMock,
      is_internal_only: isInternalOnly,
    },
    evaluation: {
      is_always_public_role: isAlwaysPublicRole,
      visibility_rule_pass: visibilityRulePass,
      can_open_public_profile: canOpenPublicProfile,
      should_show_view_profile_button: canOpenPublicProfile,
      deny_reasons: denyReasons,
    },
  });
}
