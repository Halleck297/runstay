import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect } from "react-router";
import { data } from "react-router";
import { Form, useActionData, useLoaderData, Link, useLocation } from "react-router";
import { Header } from "~/components/Header";
import { useI18n } from "~/hooks/useI18n";
import type { TranslationKey } from "~/lib/i18n";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export const meta: MetaFunction = () => {
  return [{ title: "Social Media - runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  if (user.user_type === "tour_operator") {
    return redirect("/profile/agency");
  }

  return { user };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();

  const instagram = formData.get("instagram");
  const strava = formData.get("strava");
  const facebook = formData.get("facebook");
  const linkedin = formData.get("linkedin");
  const website = formData.get("website");

  const updateData = {
    instagram: (instagram as string) || null,
    strava: (strava as string) || null,
    facebook: (facebook as string) || null,
    linkedin: (linkedin as string) || null,
    website: (website as string) || null,
  };

  const { error } = await supabaseAdmin.from("profiles").update(updateData).eq("id", user.id);

  if (error) {
    return data({ error: error.message }, { status: 400 });
  }

  return data({ success: true });
}

const sidebarNavItems: Array<{ key: TranslationKey; href: string; icon: string }> = [
  { key: "profile.nav.personal_info", href: "/profile", icon: "user" },
  { key: "profile.nav.running_experience", href: "/profile/experience", icon: "running" },
  { key: "profile.nav.social_media", href: "/profile/social", icon: "share" },
  { key: "profile.nav.settings", href: "/profile/settings", icon: "settings" },
];

export default function SocialMedia() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as { error: string } | { success: boolean } | undefined;
  const location = useLocation();
  const { t } = useI18n();

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
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />

      <div className="mx-auto max-w-7xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="flex-shrink-0 lg:w-64">
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="mb-6 flex flex-col items-center text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-2xl font-bold text-white">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.full_name || t("common.user")}
                      className="h-20 w-20 rounded-full object-cover"
                    />
                  ) : (
                    getInitials(user.full_name)
                  )}
                </div>
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
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                        isActive ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
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
            <div className="mb-6">
              <h1 className="font-display text-2xl font-bold text-gray-900">{t("profile.social.title")}</h1>
              <p className="mt-1 text-gray-500">{t("profile.social.subtitle")}</p>
            </div>

            {actionData && "success" in actionData && actionData.success && (
              <div className="mb-6 flex items-center gap-2 rounded-xl bg-success-50 p-4 text-sm text-success-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t("profile.success.social_updated")}
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                    {t("profile.social.instagram")}
                  </label>
                  <div className="mt-1 flex items-center">
                    <span className="mr-1 text-gray-400">@</span>
                    <input
                      name="instagram"
                      type="text"
                      defaultValue={(user as any).instagram || ""}
                      className="block w-full border-0 bg-transparent p-0 font-medium text-gray-900 focus:outline-none focus:ring-0"
                      placeholder={t("profile.social.username_placeholder")}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                    </svg>
                    {t("profile.social.strava")}
                  </label>
                  <input
                    name="strava"
                    type="url"
                    defaultValue={(user as any).strava || ""}
                    className="mt-1 block w-full border-0 bg-transparent p-0 font-medium text-gray-900 focus:outline-none focus:ring-0"
                    placeholder={t("profile.social.strava_placeholder")}
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    {t("profile.social.facebook")}
                  </label>
                  <input
                    name="facebook"
                    type="url"
                    defaultValue={(user as any).facebook || ""}
                    className="mt-1 block w-full border-0 bg-transparent p-0 font-medium text-gray-900 focus:outline-none focus:ring-0"
                    placeholder={t("profile.social.facebook_placeholder")}
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    {t("profile.social.linkedin")}
                  </label>
                  <input
                    name="linkedin"
                    type="url"
                    defaultValue={(user as any).linkedin || ""}
                    className="mt-1 block w-full border-0 bg-transparent p-0 font-medium text-gray-900 focus:outline-none focus:ring-0"
                    placeholder={t("profile.social.linkedin_placeholder")}
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300 md:col-span-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    {t("profile.social.website")}
                  </label>
                  <input
                    name="website"
                    type="url"
                    defaultValue={(user as any).website || ""}
                    className="mt-1 block w-full border-0 bg-transparent p-0 font-medium text-gray-900 focus:outline-none focus:ring-0"
                    placeholder={t("profile.social.website_placeholder")}
                  />
                </div>
              </div>

              <div className="mt-6">
                <button type="submit" className="btn-primary px-8">
                  {t("profile.actions.save_changes")}
                </button>
              </div>
            </Form>
          </main>
        </div>
      </div>
    </div>
  );
}
