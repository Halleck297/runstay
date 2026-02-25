import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { Form, useActionData, useLoaderData, Link, useLocation, useNavigation } from "react-router";
import { useState } from "react";
import { useI18n } from "~/hooks/useI18n";
import type { TranslationKey } from "~/lib/i18n";
import { NO_AVATAR_VALUE, OPEN_DOODLE_AVATARS, isValidOpenDoodleAvatar } from "~/lib/avatars";
import { getCountryDisplayName } from "~/lib/supportedCountries";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export const meta: MetaFunction = () => {
  return [{ title: "My Profile - runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  return { user };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const isTourOperator = user.user_type === "tour_operator";
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

  const fullName = formData.get("fullName");
  const country = formData.get("country");
  const city = formData.get("city");
  const bio = formData.get("bio");

  if (typeof fullName !== "string" || !fullName.trim()) {
    return data({ error: "Full name is required" }, { status: 400 });
  }

  const normalizedFullName = fullName.trim();
  const normalizedCity = typeof city === "string" ? city.trim() : "";
  const normalizedBio = typeof bio === "string" ? bio.trim() : "";

  if (normalizedFullName.length < 2 || normalizedFullName.length > 80) {
    return data({ error: "Full name must be between 2 and 80 characters." }, { status: 400 });
  }

  if (normalizedCity.length > 80) {
    return data({ error: "City cannot exceed 80 characters." }, { status: 400 });
  }

  if (normalizedBio.length > 600) {
    return data({ error: "Bio cannot exceed 600 characters." }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {
    full_name: normalizedFullName,
    country: user.country || null,
    city: normalizedCity || null,
    bio: normalizedBio || null,
  };

  if (isTourOperator) {
    const companyName = formData.get("companyName");
    const phone = formData.get("phone");
    const website = formData.get("website");
    const languagesSpoken = formData.get("languages_spoken");
    const yearsExperience = formData.get("yearsExperience");
    const specialties = formData.get("specialties");
    const instagram = formData.get("instagram");
    const facebook = formData.get("facebook");
    const linkedin = formData.get("linkedin");

    if (typeof companyName !== "string" || !companyName.trim()) {
      return data({ error: "Company name is required for tour operators." }, { status: 400 });
    }

    const normalizedCompanyName = companyName.trim();
    const normalizedPhone = typeof phone === "string" ? phone.trim() : "";
    const normalizedWebsite = typeof website === "string" ? website.trim() : "";
    const normalizedLanguagesSpoken = typeof languagesSpoken === "string" ? languagesSpoken.trim() : "";
    const normalizedSpecialties = typeof specialties === "string" ? specialties.trim() : "";
    const normalizedInstagram = (typeof instagram === "string" ? instagram.trim() : "").replace(/^@+/, "");
    const normalizedFacebook = typeof facebook === "string" ? facebook.trim() : "";
    const normalizedLinkedin = typeof linkedin === "string" ? linkedin.trim() : "";

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

    if (normalizedCompanyName.length > 120) {
      return data({ error: "Company name cannot exceed 120 characters." }, { status: 400 });
    }

    if (normalizedPhone.length > 40) {
      return data({ error: "Phone number cannot exceed 40 characters." }, { status: 400 });
    }

    if (normalizedLanguagesSpoken.length > 200) {
      return data({ error: "Languages cannot exceed 200 characters." }, { status: 400 });
    }

    if (normalizedSpecialties.length > 1000) {
      return data({ error: "Specialties cannot exceed 1000 characters." }, { status: 400 });
    }

    if (normalizedInstagram.length > 30) {
      return data({ error: "Instagram username cannot exceed 30 characters." }, { status: 400 });
    }

    if (normalizedInstagram && !/^[a-zA-Z0-9._]+$/.test(normalizedInstagram)) {
      return data({ error: "Instagram username contains invalid characters." }, { status: 400 });
    }

    let yearsExperienceValue: number | null = null;
    if (typeof yearsExperience === "string" && yearsExperience.trim()) {
      yearsExperienceValue = Number.parseInt(yearsExperience, 10);
      if (!Number.isFinite(yearsExperienceValue) || Number.isNaN(yearsExperienceValue) || yearsExperienceValue < 0 || yearsExperienceValue > 200) {
        return data({ error: "Years in business must be a number between 0 and 200." }, { status: 400 });
      }
    }

    let websiteUrl: string | null = null;
    let facebookUrl: string | null = null;
    let linkedinUrl: string | null = null;
    try {
      websiteUrl = normalizeUrl(normalizedWebsite, "Website URL");
      facebookUrl = normalizeUrl(normalizedFacebook, "Facebook URL");
      linkedinUrl = normalizeUrl(normalizedLinkedin, "LinkedIn URL");
    } catch (error) {
      return data({ error: error instanceof Error ? error.message : "Invalid URL value." }, { status: 400 });
    }

    updateData.company_name = normalizedCompanyName;
    updateData.phone = normalizedPhone || null;
    updateData.website = websiteUrl;
    updateData.languages_spoken = normalizedLanguagesSpoken || null;
    updateData.years_experience = yearsExperienceValue;
    updateData.specialties = normalizedSpecialties || null;
    updateData.instagram = normalizedInstagram || null;
    updateData.facebook = facebookUrl;
    updateData.linkedin = linkedinUrl;
  }

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

export default function ProfileIndex() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as { error: string } | { success: boolean } | undefined;
  const location = useLocation();
  const navigation = useNavigation();
  const { t, locale } = useI18n();
  const isSubmitting = navigation.state === "submitting" && navigation.formMethod?.toLowerCase() === "post";
  const isUpdatingAvatar = navigation.state === "submitting" && navigation.formData?.get("intent") === "update_avatar";
  const isTourOperator = user.user_type === "tour_operator";
  const visibleSidebarNavItems = isTourOperator ? [sidebarNavItems[0]] : sidebarNavItems;
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string>(
    user.avatar_url && isValidOpenDoodleAvatar(user.avatar_url) ? user.avatar_url : NO_AVATAR_VALUE,
  );
  const countryDisplayValue = getCountryDisplayName((user as any).country, locale);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };
  const stripUrlProtocol = (value: string | null | undefined) => (value ? value.replace(/^https?:\/\//i, "") : "");

  return (
    <div className="min-h-screen bg-slate-50 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.14)_1px,transparent_0)] bg-[size:18px_18px]">

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
                  {isTourOperator ? t("common.tour_operator") : t("profile.avatar.private_runner")}
                </span>
              </div>

              <nav className="space-y-1">
                {visibleSidebarNavItems.map((item) => {
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
              <h1 className="font-display text-2xl font-bold text-gray-900">{t("profile.main.personal_info_title")}</h1>
              <p className="mt-1 text-gray-600">{t("profile.main.personal_info_subtitle")}</p>
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

            <Form method="post" className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                  <label className="text-sm font-medium text-gray-500">{t("profile.form.full_name")}</label>
                  <input
                    name="fullName"
                    type="text"
                    defaultValue={user.full_name || ""}
                    className="mt-1 block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0"
                    placeholder={t("profile.form.full_name_placeholder")}
                    required
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-500">
                        {t("profile.form.email_address")} <span className="text-gray-400">({t("profile.form.not_visible")})</span>
                      </label>
                      <p className="mt-1 font-medium text-gray-900">{user.email}</p>
                    </div>
                    <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>

                {isTourOperator ? (
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                    <label className="text-sm font-medium text-gray-500">{t("profile.form.phone_number")}</label>
                    <input
                      name="phone"
                      type="tel"
                      defaultValue={user.phone || ""}
                      className="mt-1 block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0"
                      placeholder="+39 123 456 7890"
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
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

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-500">{t("profile.form.account_type")}</label>
                      <p className="mt-1 font-medium text-gray-900">{isTourOperator ? t("common.tour_operator") : t("profile.avatar.private_runner")}</p>
                    </div>
                    <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>

                {isTourOperator && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                    <label className="text-sm font-medium text-gray-500">{t("profile.agency.company_name_required")}</label>
                    <input
                      name="companyName"
                      type="text"
                      defaultValue={(user as any).company_name || ""}
                      className="mt-1 block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0"
                      required
                    />
                  </div>
                )}

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                  <div className="flex items-start justify-between">
                    <label className="text-sm font-medium text-gray-500">{t("profile.form.country")}</label>
                    <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    name="country"
                    type="text"
                    defaultValue={countryDisplayValue}
                    className="mt-1 block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0"
                    placeholder={t("profile.form.country_placeholder")}
                    readOnly
                  />
                  <p className="mt-2 text-xs text-gray-400">To update country, contact admin.</p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                  <label className="text-sm font-medium text-gray-500">{t("profile.form.city")}</label>
                  <input
                    name="city"
                    type="text"
                    defaultValue={(user as any).city || ""}
                    className="mt-1 block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0"
                    placeholder={t("profile.form.city_placeholder")}
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:col-span-2 md:p-5">
                  <label className="text-sm font-medium text-gray-500">{t("profile.form.about_me")}</label>
                  <textarea
                    name="bio"
                    rows={3}
                    defaultValue={(user as any).bio || ""}
                    className="mt-1 block w-full resize-none border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0"
                    placeholder={t("profile.form.about_me_placeholder")}
                  />
                  <p className="mt-2 text-xs text-gray-400">{t("profile.form.about_me_help")}</p>
                </div>

                {isTourOperator && (
                  <>
                    <div className="md:col-span-2 mt-2 border-t border-gray-200 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {t("common.tour_operator")}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                      <label className="text-sm font-medium text-gray-500">{t("profile.agency.company_website")}</label>
                      <input
                        name="website"
                        type="text"
                        defaultValue={stripUrlProtocol((user as any).website)}
                        className="mt-1 block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0"
                        placeholder="www.yourcompany.com"
                        inputMode="url"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                      <label className="text-sm font-medium text-gray-500">{t("profile.agency.languages_spoken")}</label>
                      <input
                        name="languages_spoken"
                        type="text"
                        defaultValue={(user as any).languages_spoken || ""}
                        className="mt-1 block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0"
                        placeholder={t("profile.agency.languages_placeholder")}
                      />
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                      <label className="text-sm font-medium text-gray-500">{t("profile.agency.years_business")}</label>
                      <input
                        name="yearsExperience"
                        type="number"
                        min="0"
                        defaultValue={(user as any).years_experience || ""}
                        className="mt-1 block w-full border-0 bg-transparent p-0 font-medium text-gray-900 [appearance:textfield] focus:outline-none focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        placeholder="5"
                      />
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:col-span-2 md:p-5">
                      <label className="text-sm font-medium text-gray-500">{t("profile.agency.specialties")}</label>
                      <textarea
                        name="specialties"
                        rows={3}
                        defaultValue={(user as any).specialties || ""}
                        className="mt-1 block w-full resize-none border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0"
                        placeholder={t("profile.agency.specialties_placeholder")}
                      />
                    </div>

                    <div className="md:col-span-2 mt-2 border-t border-gray-200 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {t("profile.social.title")}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                      <label className="text-sm font-medium text-gray-500">{t("profile.social.instagram")}</label>
                      <div className="mt-1 flex items-center">
                        <span className="mr-1 text-gray-400">@</span>
                        <input
                          name="instagram"
                          type="text"
                          defaultValue={(user as any).instagram || ""}
                          className="block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0"
                          placeholder={t("profile.social.username_placeholder")}
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                      <label className="text-sm font-medium text-gray-500">{t("profile.agency.facebook_page")}</label>
                      <input
                        name="facebook"
                        type="text"
                        defaultValue={stripUrlProtocol((user as any).facebook)}
                        className="mt-1 block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0"
                        placeholder="facebook.com/yourcompany"
                        inputMode="url"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:col-span-2 md:p-5">
                      <label className="text-sm font-medium text-gray-500">{t("profile.agency.linkedin_company")}</label>
                      <input
                        name="linkedin"
                        type="text"
                        defaultValue={stripUrlProtocol((user as any).linkedin)}
                        className="mt-1 block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0"
                        placeholder="linkedin.com/company/yourcompany"
                        inputMode="url"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="mt-6 hidden md:block">
                <button type="submit" className="btn-primary rounded-full px-8 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting}>
                  {isSubmitting ? `${t("profile.actions.save_changes")}...` : t("profile.actions.save_changes")}
                </button>
              </div>

              <div className="fixed inset-x-0 bottom-20 z-30 border-t border-gray-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
                <button type="submit" className="btn-primary w-full rounded-full disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting}>
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
