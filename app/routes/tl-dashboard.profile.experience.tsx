import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { Form, useActionData, useLoaderData, Link, useLocation, useNavigation } from "react-router";
import { useState } from "react";
import { useI18n } from "~/hooks/useI18n";
import { NO_AVATAR_VALUE, OPEN_DOODLE_AVATARS, isValidOpenDoodleAvatar } from "~/lib/avatars";
import type { TranslationKey } from "~/lib/i18n";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export const meta: MetaFunction = () => {
  return [{ title: "Running Experience - runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  return { user };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const marathonsCompleted = formData.get("marathonsCompleted");
  const marathonPB = formData.get("marathonPB");
  const marathonPBLocation = formData.get("marathonPBLocation");
  const halfMarathonsCompleted = formData.get("halfMarathonsCompleted");
  const halfMarathonPB = formData.get("halfMarathonPB");
  const halfMarathonPBLocation = formData.get("halfMarathonPBLocation");
  const favoriteRaces = formData.get("favoriteRaces");
  const runningGoals = formData.get("runningGoals");
  const avatarUrl = formData.get("avatarUrl");

  if (intent === "update_avatar" && typeof avatarUrl === "string") {
    const avatarUpdate: { avatar_url: string | null } | null =
      avatarUrl === NO_AVATAR_VALUE ? { avatar_url: null } : avatarUrl && isValidOpenDoodleAvatar(avatarUrl) ? { avatar_url: avatarUrl } : null;
    if (!avatarUpdate) {
      return data({ error: "Invalid avatar selection." }, { status: 400 });
    }
    const { error } = await supabaseAdmin.from("profiles").update(avatarUpdate).eq("id", user.id);
    if (error) {
      return data({ error: error.message }, { status: 400 });
    }
    return data({ success: true });
  }

  const parseNonNegativeInt = (value: FormDataEntryValue | null, fieldLabel: string) => {
    if (typeof value !== "string" || value.trim() === "") return null;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0 || parsed > 1000) {
      throw new Error(`${fieldLabel} must be a number between 0 and 1000.`);
    }
    return parsed;
  };

  const normalizeText = (value: FormDataEntryValue | null) => (typeof value === "string" ? value.trim() : "");
  const timePattern = /^(?:\d{1,2}):[0-5]\d:[0-5]\d$/;

  let marathonsCompletedValue: number | null = null;
  let halfMarathonsCompletedValue: number | null = null;

  try {
    marathonsCompletedValue = parseNonNegativeInt(marathonsCompleted, "Marathons completed");
    halfMarathonsCompletedValue = parseNonNegativeInt(halfMarathonsCompleted, "Half marathons completed");
  } catch (error) {
    return data({ error: error instanceof Error ? error.message : "Invalid numeric value." }, { status: 400 });
  }

  const marathonPBValue = normalizeText(marathonPB);
  const halfMarathonPBValue = normalizeText(halfMarathonPB);
  const marathonPBLocationValue = normalizeText(marathonPBLocation);
  const halfMarathonPBLocationValue = normalizeText(halfMarathonPBLocation);
  const favoriteRacesValue = normalizeText(favoriteRaces);
  const runningGoalsValue = normalizeText(runningGoals);

  if (marathonPBValue && !timePattern.test(marathonPBValue)) {
    return data({ error: "Marathon PB must be in HH:MM:SS format." }, { status: 400 });
  }

  if (halfMarathonPBValue && !timePattern.test(halfMarathonPBValue)) {
    return data({ error: "Half marathon PB must be in HH:MM:SS format." }, { status: 400 });
  }

  if (marathonPBLocationValue.length > 120) {
    return data({ error: "Marathon PB location cannot exceed 120 characters." }, { status: 400 });
  }

  if (halfMarathonPBLocationValue.length > 120) {
    return data({ error: "Half marathon PB location cannot exceed 120 characters." }, { status: 400 });
  }

  if (favoriteRacesValue.length > 1000) {
    return data({ error: "Favorite races cannot exceed 1000 characters." }, { status: 400 });
  }

  if (runningGoalsValue.length > 1000) {
    return data({ error: "Running goals cannot exceed 1000 characters." }, { status: 400 });
  }

  const updateData = {
    marathons_completed: marathonsCompletedValue,
    marathon_pb: marathonPBValue || null,
    marathon_pb_location: marathonPBLocationValue || null,
    half_marathons_completed: halfMarathonsCompletedValue,
    half_marathon_pb: halfMarathonPBValue || null,
    half_marathon_pb_location: halfMarathonPBLocationValue || null,
    favorite_races: favoriteRacesValue || null,
    running_goals: runningGoalsValue || null,
  };

  const { error } = await supabaseAdmin.from("profiles").update(updateData).eq("id", user.id);

  if (error) {
    return data({ error: error.message }, { status: 400 });
  }

  return data({ success: true });
}

const sidebarNavItems: Array<{ key: TranslationKey; href: string; icon: string }> = [
  { key: "profile.nav.personal_info", href: "/tl-dashboard/profile", icon: "user" },
  { key: "profile.nav.running_experience", href: "/tl-dashboard/profile/experience", icon: "running" },
  { key: "profile.nav.social_media", href: "/tl-dashboard/profile/social", icon: "share" },
  { key: "profile.nav.settings", href: "/tl-dashboard/settings", icon: "settings" },
];

export default function RunningExperience() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as { error: string } | { success: boolean } | undefined;
  const location = useLocation();
  const navigation = useNavigation();
  const { t } = useI18n();
  const isSubmitting = navigation.state === "submitting" && navigation.formMethod?.toLowerCase() === "post";
  const isUpdatingAvatar = navigation.state === "submitting" && navigation.formData?.get("intent") === "update_avatar";
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string>(
    user.avatar_url && isValidOpenDoodleAvatar(user.avatar_url) ? user.avatar_url : NO_AVATAR_VALUE,
  );

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-[#ECF4FE] bg-[radial-gradient(circle_at_1px_1px,rgba(12,120,243,0.08)_1px,transparent_0)] bg-[size:18px_18px]">

      <div className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 md:py-8 md:pb-8 lg:px-8">
        <div className="flex flex-col gap-6 md:gap-8 lg:flex-row">
          <aside className="flex-shrink-0 lg:w-64">
            <div className="rounded-3xl border border-gray-200/80 bg-white/95 p-4 shadow-[0_10px_35px_-18px_rgba(15,23,42,0.35)] backdrop-blur-sm md:p-6">
              <div className="mb-6 flex flex-col items-center text-center">
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-2xl font-bold text-white ring-offset-2 transition-all hover:scale-[1.03] hover:ring-2 hover:ring-brand-300 md:h-24 md:w-24 md:text-3xl"
                  aria-label="Choose avatar"
                >
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.full_name || t("common.user")}
                      className="h-20 w-20 rounded-full object-cover md:h-24 md:w-24"
                    />
                  ) : (
                    getInitials(user.full_name)
                  )}
                </button>
                <p className="-mt-1 mb-3 text-xs font-medium text-gray-500">{t("profile.avatar.click_to_change")}</p>
                <h2 className="font-display text-lg font-semibold text-gray-900">
                  {user.full_name || t("profile.avatar.your_name")}
                </h2>
                <p className="mt-1 text-sm text-gray-500">{user.email}</p>
                <span className="mt-2 inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                  {t("profile.avatar.private_runner")}
                </span>
              </div>

              <nav className="space-y-1">
                {sidebarNavItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.key}
                      to={item.href}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-brand-100 text-brand-800 shadow-sm ring-1 ring-brand-200"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      {item.icon === "user" && (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                      {item.icon === "running" && (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )}
                      {item.icon === "share" && (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      )}
                      {item.icon === "settings" && (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                      {t(item.key)}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            <div className="mb-6 rounded-3xl border border-brand-200/70 bg-gradient-to-r from-brand-50 via-white to-orange-50 p-6 shadow-sm">
              <h1 className="font-display text-2xl font-bold text-gray-900">{t("profile.experience.title")}</h1>
              <p className="mt-1 text-gray-600">{t("profile.experience.subtitle")}</p>
            </div>

            {actionData && "success" in actionData && actionData.success && (
              <div className="mb-6 flex items-center gap-2 rounded-xl bg-success-50 p-4 text-sm text-success-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t("profile.success.experience_updated")}
              </div>
            )}

            {actionData && "error" in actionData && actionData.error && (
              <div className="mb-6 flex items-center gap-2 rounded-xl bg-alert-50 p-4 text-sm text-alert-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {actionData.error}
              </div>
            )}

            <Form method="post">
              <h3 className="mb-3 font-display text-lg font-semibold text-gray-900">{t("profile.experience.marathons")}</h3>
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                  <label className="text-sm font-medium text-gray-500">{t("profile.experience.completed")}</label>
                  <input
                    name="marathonsCompleted"
                    type="number"
                    min="0"
                    defaultValue={(user as any).marathons_completed || ""}
                    className="mt-1 block w-full border-0 bg-transparent p-0 font-medium text-gray-900 [appearance:textfield] focus:outline-none focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="0"
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                  <label className="text-sm font-medium text-gray-500">{t("profile.experience.personal_best")}</label>
                  <input
                    name="marathonPB"
                    type="text"
                    defaultValue={(user as any).marathon_pb || ""}
                    className="mt-1 block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0"
                    placeholder="3:45:00"
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                  <label className="text-sm font-medium text-gray-500">{t("profile.experience.pb_location")}</label>
                  <input
                    name="marathonPBLocation"
                    type="text"
                    defaultValue={(user as any).marathon_pb_location || ""}
                    className="mt-1 block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0"
                    placeholder="Berlin 2023"
                  />
                </div>
              </div>

              <h3 className="mb-3 font-display text-lg font-semibold text-gray-900">{t("profile.experience.half_marathons")}</h3>
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                  <label className="text-sm font-medium text-gray-500">{t("profile.experience.completed")}</label>
                  <input
                    name="halfMarathonsCompleted"
                    type="number"
                    min="0"
                    defaultValue={(user as any).half_marathons_completed || ""}
                    className="mt-1 block w-full border-0 bg-transparent p-0 font-medium text-gray-900 [appearance:textfield] focus:outline-none focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="0"
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                  <label className="text-sm font-medium text-gray-500">{t("profile.experience.personal_best")}</label>
                  <input
                    name="halfMarathonPB"
                    type="text"
                    defaultValue={(user as any).half_marathon_pb || ""}
                    className="mt-1 block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0"
                    placeholder="1:45:00"
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                  <label className="text-sm font-medium text-gray-500">{t("profile.experience.pb_location")}</label>
                  <input
                    name="halfMarathonPBLocation"
                    type="text"
                    defaultValue={(user as any).half_marathon_pb_location || ""}
                    className="mt-1 block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0"
                    placeholder="Valencia 2024"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5 md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">{t("profile.experience.favorite_races")}</label>
                  <textarea
                    name="favoriteRaces"
                    rows={3}
                    defaultValue={(user as any).favorite_races || ""}
                    className="mt-1 block w-full resize-none border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0"
                    placeholder={t("profile.experience.favorite_races_placeholder")}
                  />
                  <p className="mt-2 text-xs text-gray-400">{t("profile.experience.favorite_races_help")}</p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5 md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">{t("profile.experience.running_goals")}</label>
                  <textarea
                    name="runningGoals"
                    rows={3}
                    defaultValue={(user as any).running_goals || ""}
                    className="mt-1 block w-full resize-none border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0"
                    placeholder={t("profile.experience.running_goals_placeholder")}
                  />
                  <p className="mt-2 text-xs text-gray-400">{t("profile.experience.running_goals_help")}</p>
                </div>
              </div>

              <div className="mt-6">
                <button type="submit" className="btn-primary rounded-full px-8 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting}>
                  {isSubmitting ? `${t("profile.actions.save_changes")}...` : t("profile.actions.save_changes")}
                </button>
              </div>
            </Form>

            {isAvatarModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-2xl rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl">
                  <div className="mb-5">
                    <h3 className="font-display text-xl font-semibold text-gray-900">Choose avatar</h3>
                    <p className="mt-1 text-sm text-gray-500">Select one avatar and save.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    <button
                      type="button"
                      onClick={() => setSelectedAvatar(NO_AVATAR_VALUE)}
                      className={`flex h-24 flex-col items-center justify-center gap-2 rounded-xl border p-2 transition-all ${
                        selectedAvatar === NO_AVATAR_VALUE ? "border-brand-400 ring-2 ring-brand-200" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold text-white">
                        {getInitials(user.full_name)}
                      </div>
                      <span className="text-xs font-semibold text-gray-700">{t("profile.avatar.initials")}</span>
                    </button>
                    {OPEN_DOODLE_AVATARS.map((avatar) => (
                      <button
                        key={avatar}
                        type="button"
                        onClick={() => setSelectedAvatar(avatar)}
                        className={`rounded-xl border p-2 transition-all ${
                          selectedAvatar === avatar ? "border-brand-400 ring-2 ring-brand-200" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <img src={avatar} alt="Avatar option" className="mx-auto h-20 w-20 rounded-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsAvatarModalOpen(false)}
                      className="rounded-full border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {t("messages.cancel")}
                    </button>
                    <Form method="post" onSubmit={() => setIsAvatarModalOpen(false)}>
                      <input type="hidden" name="intent" value="update_avatar" />
                      <input type="hidden" name="avatarUrl" value={selectedAvatar} />
                      <button type="submit" className="btn-primary rounded-full px-6 disabled:cursor-not-allowed disabled:opacity-60" disabled={isUpdatingAvatar}>
                        {t("profile.actions.save_changes")}
                      </button>
                    </Form>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
