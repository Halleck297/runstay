import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData, useLocation } from "react-router";
import { getUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";
import { FooterLight } from "~/components/FooterLight";
import { useI18n } from "~/hooks/useI18n";
import { isAdmin } from "~/lib/user-access";
import { getPublicDisplayName, getPublicInitial } from "~/lib/user-display";
import { applyProfilePublicIdFilter } from "~/lib/publicIds";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const name = (data as any)?.profile?.company_name || (data as any)?.profile?.full_name || "Profile";
  return [{ title: `${name} - Runoot` }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getUser(request);
  const profileId = params.id;
  const debugMode = new URL(request.url).searchParams.get("debug") === "1";

  if (!profileId) throw new Response("Not found", { status: 404 });

  // Use wildcard projection to avoid runtime 404 caused by schema drift
  // (missing newly-added columns in local/staging DBs).
  const profileQuery = supabaseAdmin.from("profiles").select("*");
  let { data: profile } = await applyProfilePublicIdFilter(
    profileQuery as any,
    profileId,
  ).maybeSingle();

  // Legacy compatibility: if short_id is missing in DB, resolve compact UUID prefix URLs.
  if (!profile && !/[^0-9a-f]/i.test(profileId) && profileId.length === 12) {
    const prefix8 = profileId.slice(0, 8);
    const next4 = profileId.slice(8, 12);
    const { data: compactMatch } = await (supabaseAdmin as any)
      .from("profiles")
      .select("*")
      .ilike("id", `${prefix8}-${next4}-%`)
      .limit(1)
      .maybeSingle();
    profile = compactMatch || null;
  }

  if (!profile) {
    if (debugMode) {
      return {
        user,
        profile: null,
        activeListingsCount: 0,
        debug: {
          profileId,
          reason: "profile_not_found",
        },
      };
    }
    throw new Response("Not found", { status: 404 });
  }
  const { data: managedRow } = await (supabaseAdmin as any)
    .from("admin_managed_accounts")
    .select("access_mode")
    .eq("user_id", profile.id)
    .maybeSingle();

  const accessMode = (managedRow?.access_mode as "internal_only" | "external_password" | "external_invite" | null) || null;
  if (accessMode === "internal_only") {
    if (debugMode) {
      return {
        user,
        profile,
        activeListingsCount: 0,
        debug: {
          profileId,
          profileDbId: profile.id,
          accessMode,
          reason: "internal_only_mock_blocked",
        },
      };
    }
    throw new Response("Not found", { status: 404 });
  }

  const isOwner = !!user && (user as any).id === profile.id;
  const userIsAdmin = !!user && isAdmin(user);
  const isAlwaysPublicRole = profile.user_type === "tour_operator" || profile.user_type === "team_leader";
  if (!isAlwaysPublicRole && profile.public_profile_enabled === false && !isOwner && !userIsAdmin) {
    if (debugMode) {
      return {
        user,
        profile,
        activeListingsCount: 0,
        debug: {
          profileId,
          profileDbId: profile.id,
          accessMode,
          isOwner,
          userIsAdmin,
          isAlwaysPublicRole,
          publicProfileEnabled: profile.public_profile_enabled,
          reason: "privacy_blocked",
        },
      };
    }
    throw new Response("Not found", { status: 404 });
  }

  const { count: activeListingsCount } = await (supabaseAdmin as any)
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("author_id", profile.id)
    .eq("status", "active");

  return {
    user,
    profile,
    activeListingsCount: activeListingsCount || 0,
    debug: debugMode
      ? {
          profileId,
          profileDbId: profile.id,
          accessMode,
          isOwner,
          userIsAdmin,
          isAlwaysPublicRole,
          publicProfileEnabled: profile.public_profile_enabled,
          reason: "visible",
        }
      : null,
  };
}

export default function PublicProfilePage() {
  const { t } = useI18n();
  const location = useLocation();
  const { user, profile, activeListingsCount, debug } = useLoaderData<typeof loader>() as any;
  const stateFrom = (location.state as any)?.from;
  const backTo =
    typeof stateFrom === "string" && stateFrom.startsWith("/")
      ? stateFrom
      : "/events";
  if (debug && debug.reason !== "visible") {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header user={user} />
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h1 className="font-display text-lg font-semibold text-amber-900">Profile Debug</h1>
            <p className="mt-1 text-sm text-amber-800">This profile is not public in current conditions.</p>
            <pre className="mt-3 overflow-auto rounded bg-white p-3 text-xs text-slate-700">
{JSON.stringify(debug, null, 2)}
            </pre>
          </div>
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header user={user} />
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Profile not found.
          </div>
        </main>
      </div>
    );
  }
  const displayName = getPublicDisplayName(profile);
  const initials = getPublicInitial(profile);
  const showPersonal = profile.public_show_personal_info !== false;
  const showExperience = profile.public_show_experience !== false;
  const showSocial = profile.public_show_social !== false;
  const roleLabel =
    profile.user_type === "team_leader"
      ? t("public_profile.role.team_leader")
      : profile.user_type === "tour_operator"
      ? "Tour Operator"
      : t("public_profile.role.runner");
  const normalizePublicUrl = (value: string | null | undefined) => {
    if (!value) return null;
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  };
  const socialLinks = [
    { key: "Instagram", href: normalizePublicUrl(profile.instagram) },
    { key: "Strava", href: normalizePublicUrl(profile.strava) },
    { key: "Facebook", href: normalizePublicUrl(profile.facebook) },
    { key: "LinkedIn", href: normalizePublicUrl(profile.linkedin) },
    { key: "Website", href: normalizePublicUrl(profile.website) },
  ].filter((item) => !!item.href);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="min-h-screen flex flex-col">
        <Header user={user} />

        <main className="mx-auto max-w-3xl w-full px-4 py-8 sm:px-6 lg:px-8 flex-grow">
          <Link
            to={backTo}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-[0_10px_26px_rgba(15,23,42,0.2)] backdrop-blur-sm transition hover:bg-white hover:shadow-[0_14px_30px_rgba(15,23,42,0.24)]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t("public_profile.back")}
          </Link>

          <div className="mt-4 rounded-2xl border border-slate-400 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.2)]">
            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-2xl font-bold text-brand-700">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="truncate font-display text-2xl font-bold text-slate-900">{displayName}</h1>
                  {profile.is_verified && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">{t("public_profile.verified")}</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {roleLabel}
                </p>
                {showPersonal && (profile.city || profile.country) && (
                  <p className="mt-1 text-sm text-slate-500">
                    {profile.city || ""}
                    {profile.city && profile.country ? ", " : ""}
                    {profile.country || ""}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{t("public_profile.active_listings")}</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{activeListingsCount}</p>
              </div>
              {showExperience && profile.years_experience != null && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{t("public_profile.experience")}</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{profile.years_experience}</p>
                </div>
              )}
              {showExperience && profile.languages_spoken && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{t("public_profile.languages")}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 break-words">{profile.languages_spoken}</p>
                </div>
              )}
            </div>

            {showPersonal && profile.bio && (
              <section className="mt-5 border-t border-slate-200 pt-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("public_profile.bio")}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{profile.bio}</p>
              </section>
            )}

            {showExperience && profile.specialties && (
              <section className="mt-5 border-t border-slate-200 pt-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("public_profile.specialties")}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{profile.specialties}</p>
              </section>
            )}

            {showSocial && socialLinks.length > 0 && (
              <section className="mt-5 border-t border-slate-200 pt-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("public_profile.social")}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {socialLinks.map((social) => (
                    <a
                      key={social.key}
                      href={social.href as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      {social.key}
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
        </main>

        <FooterLight />
      </div>
    </div>
  );
}
