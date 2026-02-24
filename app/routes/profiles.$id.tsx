import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";
import { applyProfilePublicIdFilter } from "~/lib/publicIds";
import { getUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";
import { FooterLight } from "~/components/FooterLight";
import { useI18n } from "~/hooks/useI18n";
import { isAdmin } from "~/lib/user-access";
import { getPublicDisplayName, getPublicInitial } from "~/lib/user-display";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const name = (data as any)?.profile?.company_name || (data as any)?.profile?.full_name || "Profile";
  return [{ title: `${name} - Runoot` }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getUser(request);
  const profileId = params.id;

  if (!profileId) throw new Response("Not found", { status: 404 });

  const profileQuery = supabaseAdmin
    .from("profiles")
    .select("id, short_id, full_name, company_name, user_type, is_verified, avatar_url, city, country, bio, years_experience, languages_spoken, specialties, instagram, strava, facebook, linkedin, website, public_profile_enabled, public_show_personal_info, public_show_experience, public_show_social");
  const { data: profile } = await applyProfilePublicIdFilter(profileQuery as any, profileId).maybeSingle();

  if (!profile) throw new Response("Not found", { status: 404 });
  const isOwner = !!user && (user as any).id === profile.id;
  const userIsAdmin = !!user && isAdmin(user);
  if (profile.public_profile_enabled === false && !isOwner && !userIsAdmin) {
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
  };
}

export default function PublicProfilePage() {
  const { t } = useI18n();
  const { user, profile, activeListingsCount } = useLoaderData<typeof loader>();
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
    <div className="min-h-screen bg-[url('/savedBG.png')] bg-cover bg-center bg-fixed">
      <div className="min-h-screen bg-gray-50/80 flex flex-col">
        <Header user={user} />

        <main className="mx-auto max-w-3xl w-full px-4 py-8 sm:px-6 lg:px-8 flex-grow">
          <Link to="/events" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 underline">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t("public_profile.back")}
          </Link>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-[0_8px_30px_rgba(15,23,42,0.08)]">
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
