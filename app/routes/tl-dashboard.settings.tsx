import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { buildTeamLeaderNavItems } from "~/components/panelNav";
import { useI18n } from "~/hooks/useI18n";
import { getTlEventNotificationSummary } from "~/lib/tl-event-notifications.server";
import { isTeamLeader } from "~/lib/user-access";

export const meta: MetaFunction = () => [{ title: "Team Leader Settings - Runoot" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!isTeamLeader(user)) return redirect("/listings");

  const userId = (user as any).id as string;
  const eventNotificationSummary = await getTlEventNotificationSummary(userId);

  const { data: visibility } = await (supabaseAdmin as any)
    .from("profiles")
    .select("public_profile_enabled, public_show_personal_info, public_show_experience, public_show_social")
    .eq("id", userId)
    .maybeSingle();

  const { data: blockedUsers } = await supabaseAdmin
    .from("blocked_users")
    .select(`
      id,
      blocked_id,
      created_at,
      blocked:profiles!blocked_users_blocked_id_fkey(id, full_name, company_name, email, avatar_url)
    `)
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });

  return {
    user,
    blockedUsers: blockedUsers || [],
    eventUnreadCount: eventNotificationSummary.totalUnread,
    visibility: {
      public_profile_enabled: visibility?.public_profile_enabled ?? true,
      public_show_personal_info: visibility?.public_show_personal_info ?? true,
      public_show_experience: visibility?.public_show_experience ?? true,
      public_show_social: visibility?.public_show_social ?? true,
    },
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  if (!isTeamLeader(user)) {
    return data({ error: "Forbidden" }, { status: 403 });
  }

  const userId = (user as any).id as string;
  const formData = await request.formData();
  const intent = formData.get("intent");
  const blockedId = formData.get("blocked_id");

  if (intent === "unblock" && typeof blockedId === "string") {
    await supabaseAdmin.from("blocked_users").delete().eq("blocker_id", userId).eq("blocked_id", blockedId);
    return data({ success: true, action: "unblocked" as const });
  }

  if (intent === "update_profile_visibility") {
    const publicProfileEnabled = formData.get("public_profile_enabled") === "on";
    const publicShowPersonalInfo = formData.get("public_show_personal_info") === "on";
    const publicShowExperience = formData.get("public_show_experience") === "on";
    const publicShowSocial = formData.get("public_show_social") === "on";

    await supabaseAdmin
      .from("profiles")
      .update({
        public_profile_enabled: publicProfileEnabled,
        public_show_personal_info: publicShowPersonalInfo,
        public_show_experience: publicShowExperience,
        public_show_social: publicShowSocial,
      } as any)
      .eq("id", userId);

    return data({ success: true, action: "visibility_updated" as const });
  }

  return data({ error: "Invalid action" }, { status: 400 });
}

export default function TLSettingsPage() {
  const { t } = useI18n();
  const { user, blockedUsers, eventUnreadCount, visibility } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | { error?: string }
    | { success?: boolean; action?: "unblocked" | "visibility_updated" }
    | undefined;
  const navigation = useNavigation();
  const isUnblocking = navigation.state === "submitting" && navigation.formData?.get("intent") === "unblock";

  return (
    <ControlPanelLayout
      panelLabel={t("tl.panel_label")}
      mobileTitle={t("tl.mobile_title")}
      homeTo="/tl-dashboard"
      compactSidebarUnder391
      user={{
        fullName: (user as any).full_name,
        email: (user as any).email,
        roleLabel: t("tl.role_label"),
        avatarUrl: (user as any).avatar_url,
      }}
      navItems={buildTeamLeaderNavItems(eventUnreadCount || 0)}
    >
      <div className="min-h-full">
        <main id="tl-settings-main" className="scroll-mt-24 px-0 py-6 pb-28 md:mx-auto md:max-w-7xl md:scroll-mt-0 md:px-8 md:py-8 md:pb-8">
          <div className="mb-4 rounded-3xl border border-brand-500 bg-white px-4 py-4 md:mb-6 md:p-6">
            <h1 className="font-display text-2xl font-bold text-gray-900">{t("profile.settings.title")}</h1>
            <p className="mt-1 text-gray-600">{t("profile.settings.subtitle")}</p>
          </div>

          {actionData && "success" in actionData && actionData.success && (
            <div className="mb-6 flex items-center gap-2 bg-success-50 p-4 text-sm text-success-700 md:rounded-xl">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {actionData.action === "visibility_updated" ? t("profile.settings.visibility_updated") : t("profile.settings.unblocked_success")}
            </div>
          )}

          {actionData && "error" in actionData && actionData.error && (
            <div className="mb-6 flex items-center gap-2 bg-alert-50 p-4 text-sm text-alert-700 md:rounded-xl">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {actionData.error === "Invalid action" ? t("profile.settings.invalid_action") : actionData.error}
            </div>
          )}

          <h3 className="mb-3 px-4 font-display text-lg font-semibold text-gray-900 md:px-0">{t("profile.settings.account")}</h3>
          <div className="mb-6 border-y border-gray-200 bg-white md:rounded-2xl md:border md:shadow-sm">
            <div className="p-4 transition-colors hover:border-gray-300 md:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("profile.settings.email")}</label>
                  <p className="mt-1 font-medium text-gray-900">{(user as any).email}</p>
                </div>
                <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>

            <div className="border-t border-gray-100 p-4 transition-colors hover:border-gray-300 md:p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <label className="text-sm font-medium text-gray-900">{t("profile.settings.change_password")}</label>
                  <p className="mt-1 text-sm text-gray-500">{t("profile.settings.update_password")}</p>
                </div>
                <Link to="/forgot-password" className="ml-auto shrink-0 text-sm font-medium text-brand-600 hover:text-brand-700">
                  {t("profile.settings.reset_password")}
                </Link>
              </div>
            </div>
          </div>

          <h3 className="mb-3 px-4 font-display text-lg font-semibold text-gray-900 md:px-0">{t("profile.settings.public_profile")}</h3>
          <div className="mb-6 border-y border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 md:rounded-2xl md:border md:shadow-sm md:p-5">
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="update_profile_visibility" />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t("profile.settings.public_profile")}</p>
                  <p className="mt-1 text-sm text-gray-500">{t("profile.settings.public_profile_help")}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" name="public_profile_enabled" defaultChecked={visibility.public_profile_enabled} className="peer sr-only" />
                  <span className="h-6 w-11 rounded-full bg-gray-300 transition peer-checked:bg-brand-500" />
                  <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                </label>
              </div>

              <div className="rounded-xl border border-gray-200 bg-slate-50 p-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{t("profile.settings.visibility_sections")}</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-700">{t("profile.settings.show_personal_info")}</p>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" name="public_show_personal_info" defaultChecked={visibility.public_show_personal_info} className="peer sr-only" />
                      <span className="h-5 w-9 rounded-full bg-gray-300 transition peer-checked:bg-brand-500" />
                      <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-700">{t("profile.settings.show_experience")}</p>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" name="public_show_experience" defaultChecked={visibility.public_show_experience} className="peer sr-only" />
                      <span className="h-5 w-9 rounded-full bg-gray-300 transition peer-checked:bg-brand-500" />
                      <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-700">{t("profile.settings.show_social")}</p>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" name="public_show_social" defaultChecked={visibility.public_show_social} className="peer sr-only" />
                      <span className="h-5 w-9 rounded-full bg-gray-300 transition peer-checked:bg-brand-500" />
                      <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <button type="submit" className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
                  {t("profile.actions.save_changes")}
                </button>
              </div>
            </Form>
          </div>

          <h3 className="mb-3 px-4 font-display text-lg font-semibold text-gray-900 md:px-0">{t("profile.settings.blocked_users")}</h3>
          <div className="mb-6 border-y border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 md:rounded-2xl md:border md:shadow-sm md:p-5">
            {blockedUsers.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {blockedUsers.map((block: any) => (
                  <div key={block.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-100 font-semibold text-gray-600">
                        {block.blocked?.avatar_url ? (
                          <img
                            src={block.blocked.avatar_url}
                            alt={block.blocked?.company_name || block.blocked?.full_name || t("profile.settings.unknown_user")}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          block.blocked?.company_name?.charAt(0) || block.blocked?.full_name?.charAt(0) || "?"
                        )}
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
                      <button
                        type="submit"
                        className="text-sm font-medium text-brand-600 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isUnblocking}
                      >
                        {isUnblocking ? `${t("profile.settings.unblock")}...` : t("profile.settings.unblock")}
                      </button>
                    </Form>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t("profile.settings.no_blocked_users")}</p>
            )}
          </div>

          <h3 className="mb-3 px-4 font-display text-lg font-semibold text-gray-900 md:px-0">{t("profile.settings.notifications")}</h3>
          <div className="mb-6 grid grid-cols-1 gap-4">
            <div className="border-y border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 md:rounded-2xl md:border md:shadow-sm md:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-900">{t("profile.settings.email_notifications")}</label>
                  <p className="mt-1 text-sm text-gray-500">{t("profile.settings.receive_messages")}</p>
                </div>
                <span className="text-sm text-gray-400">{t("profile.settings.coming_soon")}</span>
              </div>
            </div>
          </div>

          <h3 className="mb-3 px-4 font-display text-lg font-semibold text-gray-900 md:px-0">{t("profile.settings.support")}</h3>
          <div className="mb-6 border-y border-gray-200 bg-white md:rounded-2xl md:border md:shadow-sm">
            <div className="p-4 transition-colors hover:border-gray-300 md:p-5">
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

            <div className="border-t border-gray-100 p-4 transition-colors hover:border-gray-300 md:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-900">{t("profile.settings.terms_privacy")}</label>
                  <p className="mt-1 text-sm text-gray-500">{t("profile.settings.read_terms_privacy")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Link to="/terms" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                    {t("profile.settings.terms")}
                  </Link>
                  <Link to="/privacy" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                    {t("profile.settings.privacy")}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <h3 className="mb-3 px-4 font-display text-lg font-semibold text-alert-600 md:px-0">{t("profile.settings.danger_zone")}</h3>
          <div className="mb-6 grid grid-cols-1 gap-4">
            <div className="border-y border-alert-200 bg-alert-50/40 p-4 transition-colors hover:border-alert-300 md:rounded-2xl md:border md:shadow-sm md:p-5">
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
    </ControlPanelLayout>
  );
}
