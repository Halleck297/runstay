import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, useActionData, useLoaderData, useLocation, useNavigation } from "react-router";
import { useState } from "react";
import { useI18n } from "~/hooks/useI18n";
import { NO_AVATAR_VALUE, OPEN_DOODLE_AVATARS, isValidOpenDoodleAvatar } from "~/lib/avatars";
import { ToProfileSidebar, type ToProfileSidebarItem } from "~/components/ToProfileSidebar";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { getPublicDisplayName, getPublicInitial } from "~/lib/user-display";
import { getCountryDisplayName } from "~/lib/supportedCountries";

export const meta: MetaFunction = () => {
  return [{ title: "My Profile - runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (user.user_type !== "tour_operator") {
    return redirect("/listings");
  }
  return { user };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  if (user.user_type !== "tour_operator") {
    return data({ error: "Unauthorized" }, { status: 403 });
  }
  const formData = await request.formData();
  const intent = formData.get("intent");

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

  const bio = formData.get("bio");
  const normalizedBio = typeof bio === "string" ? bio.trim() : "";

  if (normalizedBio.length > 600) {
    return data({ error: "Bio cannot exceed 600 characters." }, { status: 400 });
  }

  // TO can only update "About us" from this page; company info is admin-managed.
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ bio: normalizedBio || null })
    .eq("id", user.id);

  if (error) {
    return data({ error: error.message }, { status: 400 });
  }

  return data({ success: true });
}

const sidebarNavItems: ToProfileSidebarItem[] = [
  { label: "Company info", href: "/to-panel/profile", icon: "user" },
  { label: "Business details", href: "/to-panel/profile/experience", icon: "running" },
];

export default function ProfileIndex() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as { error: string } | { success: boolean } | undefined;
  const location = useLocation();
  const navigation = useNavigation();
  const { t, locale } = useI18n();
  const isUpdatingAvatar = navigation.state === "submitting" && navigation.formData?.get("intent") === "update_avatar";
  const isTourOperator = user.user_type === "tour_operator";
  const publicName = getPublicDisplayName(user);
  const countryDisplayValue = getCountryDisplayName((user as any).country, locale);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string>(
    user.avatar_url && isValidOpenDoodleAvatar(user.avatar_url) ? user.avatar_url : NO_AVATAR_VALUE,
  );

  return (
    <div className="min-h-screen bg-slate-50 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.14)_1px,transparent_0)] bg-[size:18px_18px]">

      <div className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 md:py-8 md:pb-8 lg:px-8">
        <div className="flex flex-col gap-6 md:gap-8 lg:flex-row">
          <ToProfileSidebar
            user={user}
            publicName={publicName}
            items={sidebarNavItems}
            locationPathname={location.pathname}
            onAvatarClick={() => setIsAvatarModalOpen(true)}
          />

          <main className="min-w-0 flex-1">
            <div className="mb-6 rounded-3xl border border-brand-200/70 bg-gradient-to-r from-brand-50 via-white to-orange-50 p-6 shadow-sm">
              <h1 className="font-display text-2xl font-bold text-gray-900">Company profile</h1>
              <p className="mt-1 text-gray-600">Manage your company information, business details, and social links.</p>
            </div>

            {actionData && "success" in actionData && actionData.success && (
              <div className="mb-6 flex items-center gap-2 rounded-xl bg-success-50 p-4 text-sm text-success-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t("profile.success.profile_updated")}
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

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div id="company-section" className="md:col-span-2 scroll-mt-24">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Company information</p>
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    To update company info, contact admin.
                  </div>
                </div>
                {isTourOperator && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm md:p-5">
                    <div className="flex items-start justify-between">
                      <label className="text-sm font-medium text-gray-500">{t("profile.agency.company_name_required")}</label>
                      <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      name="companyName"
                      type="text"
                      defaultValue={(user as any).company_name || ""}
                      className="mt-1 block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-700 focus:outline-none focus:ring-0"
                      readOnly
                    />
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm md:p-5">
                  <div className="flex items-start justify-between">
                    <label className="text-sm font-medium text-gray-500">Representative full name</label>
                    <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    name="fullName"
                    type="text"
                    defaultValue={user.full_name || ""}
                    className="mt-1 block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-700 focus:outline-none focus:ring-0"
                    placeholder="Name and surname"
                    readOnly
                  />
                  <p className="mt-2 text-xs text-gray-400">Internal use only, visible to admin.</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm md:p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-500">
                        {t("profile.form.email_address")} <span className="text-gray-400">({t("profile.form.not_visible")})</span>
                      </label>
                      <p className="mt-1 font-medium text-gray-700">{user.email}</p>
                    </div>
                    <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm md:p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-500">{t("profile.form.account_type")}</label>
                      <p className="mt-1 font-medium text-gray-700">{isTourOperator ? t("common.tour_operator") : t("profile.avatar.private_runner")}</p>
                    </div>
                    <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>

                {isTourOperator ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm md:p-5">
                    <div className="flex items-start justify-between">
                      <label className="text-sm font-medium text-gray-500">{t("profile.form.phone_number")}</label>
                      <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <p className="mt-1 font-medium text-gray-700">{user.phone || t("profile.form.not_set")}</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm md:p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <label className="text-sm font-medium text-gray-500">
                          {t("profile.form.phone_number")} <span className="text-gray-400">({t("profile.form.not_visible")})</span>
                        </label>
                        <p className="mt-1 font-medium text-gray-900">{user.phone || t("profile.form.not_set")}</p>
                      </div>
                      <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm md:p-5">
                  <div className="flex items-start justify-between">
                    <label className="text-sm font-medium text-gray-500">{t("profile.agency.company_website")}</label>
                    <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <p className="mt-1 font-medium text-gray-700">{(user as any).website || t("profile.form.not_set")}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm md:p-5">
                  <div className="flex items-start justify-between">
                    <label className="text-sm font-medium text-gray-500">{t("profile.form.country")}</label>
                    <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <p className="mt-1 font-medium text-gray-700">{countryDisplayValue || t("profile.form.not_set")}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm md:p-5">
                  <div className="flex items-start justify-between">
                    <label className="text-sm font-medium text-gray-500">{t("profile.form.city")}</label>
                    <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <p className="mt-1 font-medium text-gray-700">{(user as any).city || t("profile.form.not_set")}</p>
                </div>

              </div>
            </div>

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
                        {getPublicInitial(user)}
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
