import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { buildTeamLeaderNavItems } from "~/components/panelNav";
import { useI18n } from "~/hooks/useI18n";
import { getTlEventNotificationSummary } from "~/lib/tl-event-notifications.server";

export const meta: MetaFunction = () => [{ title: "Team Leader Profile - Runoot" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!(user as any).is_team_leader) return redirect("/listings");
  const eventNotificationSummary = await getTlEventNotificationSummary((user as any).id);
  return { user, eventUnreadCount: eventNotificationSummary.totalUnread };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  if (!(user as any).is_team_leader) {
    return data({ errorKey: "only_team_leader" as const }, { status: 403 });
  }

  const formData = await request.formData();

  const fullName = String(formData.get("fullName") || "").trim();
  const country = String(formData.get("country") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const bio = String(formData.get("bio") || "").trim();
  const instagram = String(formData.get("instagram") || "").trim().replace(/^@+/, "");
  const strava = String(formData.get("strava") || "").trim();
  const facebook = String(formData.get("facebook") || "").trim();
  const linkedin = String(formData.get("linkedin") || "").trim();
  const website = String(formData.get("website") || "").trim();

  if (!fullName) {
    return data({ errorKey: "full_name_required" as const }, { status: 400 });
  }

  if (fullName.length < 2 || fullName.length > 80) {
    return data({ error: "Full name must be between 2 and 80 characters." }, { status: 400 });
  }
  if (country.length > 80) {
    return data({ error: "Country cannot exceed 80 characters." }, { status: 400 });
  }
  if (city.length > 80) {
    return data({ error: "City cannot exceed 80 characters." }, { status: 400 });
  }
  if (bio.length > 600) {
    return data({ error: "Bio cannot exceed 600 characters." }, { status: 400 });
  }
  if (instagram.length > 30) {
    return data({ error: "Instagram username cannot exceed 30 characters." }, { status: 400 });
  }
  if (instagram && !/^[a-zA-Z0-9._]+$/.test(instagram)) {
    return data({ error: "Instagram username contains invalid characters." }, { status: 400 });
  }

  const normalizeUrl = (value: string, fieldLabel: string) => {
    if (!value) return null;
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      const parsed = new URL(withScheme);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error();
      }
      return parsed.toString();
    } catch {
      throw new Error(`${fieldLabel} must be a valid URL (http/https).`);
    }
  };

  let stravaUrl: string | null = null;
  let facebookUrl: string | null = null;
  let linkedinUrl: string | null = null;
  let websiteUrl: string | null = null;
  try {
    stravaUrl = normalizeUrl(strava, "Strava URL");
    facebookUrl = normalizeUrl(facebook, "Facebook URL");
    linkedinUrl = normalizeUrl(linkedin, "LinkedIn URL");
    websiteUrl = normalizeUrl(website, "Website URL");
  } catch (error) {
    return data({ error: error instanceof Error ? error.message : "Invalid URL value." }, { status: 400 });
  }

  const updateData = {
    full_name: fullName,
    country: country || null,
    city: city || null,
    bio: bio || null,
    marathons_completed: formData.get("marathonsCompleted") ? Number(formData.get("marathonsCompleted")) : null,
    marathon_pb: String(formData.get("marathonPB") || "").trim() || null,
    marathon_pb_location: String(formData.get("marathonPBLocation") || "").trim() || null,
    half_marathons_completed: formData.get("halfMarathonsCompleted") ? Number(formData.get("halfMarathonsCompleted")) : null,
    half_marathon_pb: String(formData.get("halfMarathonPB") || "").trim() || null,
    half_marathon_pb_location: String(formData.get("halfMarathonPBLocation") || "").trim() || null,
    favorite_races: String(formData.get("favoriteRaces") || "").trim() || null,
    running_goals: String(formData.get("runningGoals") || "").trim() || null,
    instagram: instagram || null,
    strava: stravaUrl,
    facebook: facebookUrl,
    linkedin: linkedinUrl,
    website: websiteUrl,
  };

  const { error } = await (supabaseAdmin.from("profiles") as any)
    .update(updateData)
    .eq("id", (user as any).id);

  if (error) {
    return data({ error: `${error.message}` }, { status: 500 });
  }

  return data({ success: true, messageKey: "profile.success.profile_updated" as const });
}

export default function TLProfilePage() {
  const { t } = useI18n();
  const { user, eventUnreadCount } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | { error?: string; success?: boolean; message?: string; errorKey?: never; messageKey?: never }
    | { errorKey?: "only_team_leader" | "full_name_required"; error?: never; success?: boolean; message?: never; messageKey?: never }
    | { success?: boolean; messageKey?: "profile.success.profile_updated"; message?: never; error?: never; errorKey?: never }
    | undefined;
  const actionError =
    actionData?.errorKey ? t(`tl_profile.error.${actionData.errorKey}` as any) : actionData?.error;
  const actionMessage =
    actionData?.messageKey ? t(actionData.messageKey) : actionData?.message;
  const stripUrlProtocol = (value: string | null | undefined) => (value ? value.replace(/^https?:\/\//i, "") : "");

  return (
    <ControlPanelLayout
      panelLabel={t("tl.panel_label")}
      mobileTitle={t("tl.mobile_title")}
      homeTo="/tl-dashboard"
      user={{
        fullName: (user as any).full_name,
        email: (user as any).email,
        roleLabel: t("tl.role_label"),
        avatarUrl: (user as any).avatar_url,
      }}
      navItems={buildTeamLeaderNavItems(eventUnreadCount || 0)}
    >
      <div className="min-h-full">
        <main className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 md:py-8 md:pb-8 lg:px-8">
          <div className="mb-6 rounded-3xl border border-brand-200/70 bg-gradient-to-r from-brand-50 via-white to-orange-50 p-6 shadow-sm">
            <h1 className="font-display text-2xl font-bold text-gray-900">{t("nav.profile")}</h1>
            <p className="mt-1 text-gray-600">{t("tl_profile.subtitle")}</p>
          </div>

          {actionError && (
            <div className="mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm">{actionError}</div>
          )}
          {actionData?.success && actionMessage && (
            <div className="mb-4 p-3 rounded-lg bg-success-50 text-success-700 text-sm">{actionMessage}</div>
          )}

          <Form method="post" className="space-y-6">
            <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm transition-colors hover:border-gray-300 space-y-4">
              <h2 className="font-display font-semibold text-gray-900">{t("profile.main.personal_info_title")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("profile.form.full_name")} *</label>
                  <input
                    name="fullName"
                    type="text"
                    defaultValue={(user as any).full_name || ""}
                    className="mt-1 input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("settings.email")}</label>
                  <input value={(user as any).email || ""} readOnly className="mt-1 input w-full bg-gray-50" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("profile.form.country")}</label>
                  <input name="country" type="text" defaultValue={(user as any).country || ""} className="mt-1 input w-full" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("profile.form.city")}</label>
                  <input name="city" type="text" defaultValue={(user as any).city || ""} className="mt-1 input w-full" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">{t("profile.form.about_me")}</label>
                  <textarea
                    name="bio"
                    rows={3}
                    defaultValue={(user as any).bio || ""}
                    className="mt-1 input w-full"
                    placeholder={t("tl_profile.bio_placeholder")}
                  />
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm transition-colors hover:border-gray-300 space-y-4">
              <h2 className="font-display font-semibold text-gray-900">{t("profile.experience.title")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("profile.experience.marathons")} {t("profile.experience.completed").toLowerCase()}</label>
                  <input name="marathonsCompleted" type="number" min={0} defaultValue={(user as any).marathons_completed || ""} className="mt-1 input w-full" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("profile.experience.marathons")} {t("profile.experience.personal_best")}</label>
                  <input name="marathonPB" type="text" defaultValue={(user as any).marathon_pb || ""} className="mt-1 input w-full" placeholder="3:45:00" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("profile.experience.marathons")} {t("profile.experience.pb_location")}</label>
                  <input name="marathonPBLocation" type="text" defaultValue={(user as any).marathon_pb_location || ""} className="mt-1 input w-full" placeholder="Berlin 2023" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("profile.experience.half_marathons")} {t("profile.experience.completed").toLowerCase()}</label>
                  <input name="halfMarathonsCompleted" type="number" min={0} defaultValue={(user as any).half_marathons_completed || ""} className="mt-1 input w-full" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("profile.experience.half_marathons")} {t("profile.experience.personal_best")}</label>
                  <input name="halfMarathonPB" type="text" defaultValue={(user as any).half_marathon_pb || ""} className="mt-1 input w-full" placeholder="1:45:00" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("profile.experience.half_marathons")} {t("profile.experience.pb_location")}</label>
                  <input name="halfMarathonPBLocation" type="text" defaultValue={(user as any).half_marathon_pb_location || ""} className="mt-1 input w-full" placeholder="Valencia 2024" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("profile.experience.favorite_races")}</label>
                  <textarea name="favoriteRaces" rows={3} defaultValue={(user as any).favorite_races || ""} className="mt-1 input w-full" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("profile.experience.running_goals")}</label>
                  <textarea name="runningGoals" rows={3} defaultValue={(user as any).running_goals || ""} className="mt-1 input w-full" />
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm transition-colors hover:border-gray-300 space-y-4">
              <h2 className="font-display font-semibold text-gray-900">{t("profile.social.title")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Instagram</label>
                  <input name="instagram" type="text" defaultValue={(user as any).instagram || ""} className="mt-1 input w-full" placeholder="username" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Strava</label>
                  <input
                    name="strava"
                    type="text"
                    defaultValue={stripUrlProtocol((user as any).strava)}
                    className="mt-1 input w-full"
                    placeholder={t("profile.social.strava_placeholder")}
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Facebook</label>
                  <input
                    name="facebook"
                    type="text"
                    defaultValue={stripUrlProtocol((user as any).facebook)}
                    className="mt-1 input w-full"
                    placeholder={t("profile.social.facebook_placeholder")}
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">LinkedIn</label>
                  <input
                    name="linkedin"
                    type="text"
                    defaultValue={stripUrlProtocol((user as any).linkedin)}
                    className="mt-1 input w-full"
                    placeholder={t("profile.social.linkedin_placeholder")}
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">{t("profile.social.website")}</label>
                  <input
                    name="website"
                    type="text"
                    defaultValue={stripUrlProtocol((user as any).website)}
                    className="mt-1 input w-full"
                    placeholder={t("profile.social.website_placeholder")}
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
              </div>
            </section>

            <button type="submit" className="btn-primary rounded-full">{t("profile.actions.save_changes")}</button>
          </Form>
        </main>
      </div>
    </ControlPanelLayout>
  );
}
