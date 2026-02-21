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
  return [{ title: "Settings - runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  if (user.user_type === "tour_operator") {
    return redirect("/profile/agency");
  }

  const userId = (user as any).id as string;

  const { data: blockedUsers } = await supabaseAdmin
    .from("blocked_users")
    .select(`
      id,
      blocked_id,
      created_at,
      blocked:profiles!blocked_users_blocked_id_fkey(id, full_name, company_name, email)
    `)
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });

  return { user, blockedUsers: blockedUsers || [] };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const userId = (user as any).id as string;

  const formData = await request.formData();
  const intent = formData.get("intent");
  const blockedId = formData.get("blocked_id");

  if (intent === "unblock" && typeof blockedId === "string") {
    await supabaseAdmin.from("blocked_users").delete().eq("blocker_id", userId).eq("blocked_id", blockedId);

    return data({ success: true, action: "unblocked" });
  }

  return data({ error: "Invalid action" }, { status: 400 });
}

const sidebarNavItems: Array<{ key: TranslationKey; href: string; icon: string }> = [
  { key: "profile.nav.personal_info", href: "/profile", icon: "user" },
  { key: "profile.nav.running_experience", href: "/profile/experience", icon: "running" },
  { key: "profile.nav.social_media", href: "/profile/social", icon: "share" },
  { key: "profile.nav.settings", href: "/profile/settings", icon: "settings" },
];

export default function Settings() {
  const { user, blockedUsers } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | { error: string }
    | { success: boolean; action: string }
    | undefined;
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
              <h1 className="font-display text-2xl font-bold text-gray-900">{t("profile.settings.title")}</h1>
              <p className="mt-1 text-gray-500">{t("profile.settings.subtitle")}</p>
            </div>

            {actionData && "success" in actionData && actionData.success && (
              <div className="mb-6 flex items-center gap-2 rounded-xl bg-success-50 p-4 text-sm text-success-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t("profile.settings.unblocked_success")}
              </div>
            )}

            {actionData && "error" in actionData && actionData.error && (
              <div className="mb-6 flex items-center gap-2 rounded-xl bg-alert-50 p-4 text-sm text-alert-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {actionData.error === "Invalid action" ? t("profile.settings.invalid_action") : actionData.error}
              </div>
            )}

            <h3 className="mb-3 font-display text-lg font-semibold text-gray-900">{t("profile.settings.account")}</h3>
            <div className="mb-6 grid grid-cols-1 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-500">{t("profile.settings.email")}</label>
                    <p className="mt-1 font-medium text-gray-900">{user.email}</p>
                  </div>
                  <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900">{t("profile.settings.change_password")}</label>
                    <p className="mt-1 text-sm text-gray-500">{t("profile.settings.update_password")}</p>
                  </div>
                  <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                    {t("profile.settings.reset_password")}
                  </Link>
                </div>
              </div>
            </div>

            <h3 className="mb-3 font-display text-lg font-semibold text-gray-900">{t("profile.settings.blocked_users")}</h3>
            <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5">
              {blockedUsers.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {blockedUsers.map((block: any) => (
                    <div key={block.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 font-semibold text-gray-600">
                          {block.blocked?.company_name?.charAt(0) || block.blocked?.full_name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {block.blocked?.company_name || block.blocked?.full_name || t("profile.settings.unknown_user")}
                          </p>
                          <p className="text-sm text-gray-500">
                            {t("profile.settings.blocked_on")} {new Date(block.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Form method="post">
                        <input type="hidden" name="intent" value="unblock" />
                        <input type="hidden" name="blocked_id" value={block.blocked_id} />
                        <button type="submit" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                          {t("profile.settings.unblock")}
                        </button>
                      </Form>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">{t("profile.settings.no_blocked_users")}</p>
              )}
            </div>

            <h3 className="mb-3 font-display text-lg font-semibold text-gray-900">{t("profile.settings.notifications")}</h3>
            <div className="mb-6 grid grid-cols-1 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900">{t("profile.settings.email_notifications")}</label>
                    <p className="mt-1 text-sm text-gray-500">{t("profile.settings.receive_messages")}</p>
                  </div>
                  <span className="text-sm text-gray-400">{t("profile.settings.coming_soon")}</span>
                </div>
              </div>
            </div>

            <h3 className="mb-3 font-display text-lg font-semibold text-gray-900">{t("profile.settings.support")}</h3>
            <div className="mb-6 grid grid-cols-1 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900">{t("profile.settings.contact_us")}</label>
                    <p className="mt-1 text-sm text-gray-500">{t("profile.settings.report_problem")}</p>
                  </div>
                  <Link to="/contact" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                    {t("profile.settings.contact")}
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900">{t("profile.settings.terms_privacy")}</label>
                    <p className="mt-1 text-sm text-gray-500">{t("profile.settings.read_terms_privacy")}</p>
                  </div>
                  <div className="flex gap-3">
                    <Link to="/terms" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                      {t("profile.settings.terms")}
                    </Link>
                    <Link to="/privacy-policy" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                      {t("profile.settings.privacy")}
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <h3 className="mb-3 font-display text-lg font-semibold text-alert-600">{t("profile.settings.danger_zone")}</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="rounded-2xl border border-alert-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900">{t("profile.settings.delete_account")}</label>
                    <p className="mt-1 text-sm text-gray-500">{t("profile.settings.delete_account_help")}</p>
                  </div>
                  <span className="text-sm text-gray-400">{t("profile.settings.coming_soon")}</span>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
