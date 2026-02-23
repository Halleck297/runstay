import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { teamLeaderNavItems } from "~/components/panelNav";
import { useI18n } from "~/hooks/useI18n";

export const meta: MetaFunction = () => [{ title: "Team Leader Profile - Runoot" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!(user as any).is_team_leader) return redirect("/listings");
  return { user };
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

  if (!fullName) {
    return data({ errorKey: "full_name_required" as const }, { status: 400 });
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
    instagram: String(formData.get("instagram") || "").trim() || null,
    strava: String(formData.get("strava") || "").trim() || null,
    facebook: String(formData.get("facebook") || "").trim() || null,
    linkedin: String(formData.get("linkedin") || "").trim() || null,
    website: String(formData.get("website") || "").trim() || null,
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
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | { error?: string; success?: boolean; message?: string; errorKey?: never; messageKey?: never }
    | { errorKey?: "only_team_leader" | "full_name_required"; error?: never; success?: boolean; message?: never; messageKey?: never }
    | { success?: boolean; messageKey?: "profile.success.profile_updated"; message?: never; error?: never; errorKey?: never }
    | undefined;
  const actionError =
    actionData?.errorKey ? t(`tl_profile.error.${actionData.errorKey}` as any) : actionData?.error;
  const actionMessage =
    actionData?.messageKey ? t(actionData.messageKey) : actionData?.message;

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
      navItems={teamLeaderNavItems}
    >
      <div className="min-h-full bg-gray-50">
        <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8">
          <div className="mb-8">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-900">{t("nav.profile")}</h1>
            <p className="text-gray-500">{t("tl_profile.subtitle")}</p>
          </div>

          {actionError && (
            <div className="mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm">{actionError}</div>
          )}
          {actionData?.success && actionMessage && (
            <div className="mb-4 p-3 rounded-lg bg-success-50 text-success-700 text-sm">{actionMessage}</div>
          )}

          <Form method="post" className="space-y-6">
            <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
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

            <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
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

            <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="font-display font-semibold text-gray-900">{t("profile.social.title")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Instagram</label>
                  <input name="instagram" type="text" defaultValue={(user as any).instagram || ""} className="mt-1 input w-full" placeholder="username" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Strava</label>
                  <input name="strava" type="url" defaultValue={(user as any).strava || ""} className="mt-1 input w-full" placeholder="https://strava.com/athletes/..." />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Facebook</label>
                  <input name="facebook" type="url" defaultValue={(user as any).facebook || ""} className="mt-1 input w-full" placeholder="https://facebook.com/..." />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">LinkedIn</label>
                  <input name="linkedin" type="url" defaultValue={(user as any).linkedin || ""} className="mt-1 input w-full" placeholder="https://linkedin.com/in/..." />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">{t("profile.social.website")}</label>
                  <input name="website" type="url" defaultValue={(user as any).website || ""} className="mt-1 input w-full" placeholder="https://yourwebsite.com" />
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
