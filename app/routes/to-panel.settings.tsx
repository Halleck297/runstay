import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { useLoaderData, useActionData, Form, Link, useNavigation } from "react-router";
import { useI18n } from "~/hooks/useI18n";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { getToNotificationPrefs, saveToNotificationPrefs } from "~/lib/to-notifications.server";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { tourOperatorNavItems } from "~/components/panelNav";
import { getPublicDisplayName } from "~/lib/user-display";

export const meta: MetaFunction = () => {
  return [{ title: "TO Panel Settings - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (user.user_type !== "tour_operator") return redirect("/listings");
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

  const { data: conversations } = await supabaseAdmin
    .from("conversations")
    .select("id, participant_1, participant_2")
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);
  const conversationIds = (conversations || []).map((c: any) => c.id);
  let unreadCount = 0;
  if (conversationIds.length > 0) {
    const { count } = await (supabaseAdmin as any)
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", conversationIds)
      .neq("sender_id", userId)
      .is("read_at", null);
    unreadCount = count || 0;
  }

  return {
    user,
    blockedUsers: blockedUsers || [],
    unreadCount,
    notificationPrefs: await getToNotificationPrefs(userId),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  if (user.user_type !== "tour_operator") {
    return data({ error: "Forbidden" }, { status: 403 });
  }
  const userId = (user as any).id as string;

  const formData = await request.formData();
  const intent = formData.get("intent");
  const blockedId = formData.get("blocked_id");

  if (intent === "unblock" && typeof blockedId === "string") {
    await supabaseAdmin
      .from("blocked_users")
      .delete()
      .eq("blocker_id", userId)
      .eq("blocked_id", blockedId);

    return data({ success: true, action: "unblocked" as const });
  }

  if (intent === "update_notifications") {
    const prefs = {
      info_request: formData.get("info_request") === "on",
      new_message: formData.get("new_message") === "on",
      listing_status: formData.get("listing_status") === "on",
      listing_expiring: formData.get("listing_expiring") === "on",
      listing_pending: formData.get("listing_pending") === "on",
      admin_action: formData.get("admin_action") === "on",
      credentials_change: formData.get("credentials_change") === "on",
    };

    await saveToNotificationPrefs(userId, prefs);
    return data({ success: true, action: "notifications_updated" as const });
  }

  return data({ error: "Invalid action" }, { status: 400 });
}

export default function ToPanelSettings() {
  const { t } = useI18n();
  const { user, blockedUsers, unreadCount, notificationPrefs } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | { error?: string }
    | { success?: boolean; action?: "unblocked" | "notifications_updated" }
    | undefined;
  const navigation = useNavigation();
  const isUnblocking = navigation.state === "submitting" && navigation.formData?.get("intent") === "unblock";
  const isUpdatingNotifications = navigation.state === "submitting" && navigation.formData?.get("intent") === "update_notifications";

  const navItems = tourOperatorNavItems.map((item) =>
    item.to === "/messages"
      ? { ...item, badgeCount: unreadCount, badgeTone: "brand" as const, hideBadgeWhenActive: true }
      : item
  );
  const publicName = getPublicDisplayName(user);

  return (
    <ControlPanelLayout
      panelLabel="Tour Operator Panel"
      mobileTitle="TO Panel"
      homeTo="/to-panel"
      user={{
        fullName: publicName,
        email: (user as any).email,
        roleLabel: "Tour Operator",
        avatarUrl: (user as any).avatar_url,
      }}
      navItems={navItems}
    >
      <div className="-m-4 min-h-full bg-slate-100 md:-m-8">
        <main className="mx-auto max-w-4xl px-4 py-6 pb-24 sm:px-6 md:py-8 md:pb-8 lg:px-8">
          <div className="mb-6 rounded-3xl border border-brand-200/70 bg-gradient-to-r from-brand-50 via-white to-orange-50 p-6 shadow-sm">
            <h1 className="font-display text-2xl font-bold text-gray-900">{t("settings.title")}</h1>
            <p className="mt-1 text-gray-600">Manage account preferences, privacy, and support options.</p>
          </div>

          {actionData && "error" in actionData && actionData.error && (
            <div className="mb-6 flex items-center gap-2 rounded-xl bg-alert-50 p-4 text-sm text-alert-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {actionData.error}
            </div>
          )}

          <section className="mb-6 rounded-3xl border border-gray-200/80 bg-white/95 p-6 shadow-[0_10px_35px_-18px_rgba(15,23,42,0.35)] backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("settings.blocked_users")}</h2>

            {actionData && "success" in actionData && actionData.action === "unblocked" && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-success-50 p-4 text-sm text-success-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t("settings.unblocked_success")}
              </div>
            )}

            {blockedUsers.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {blockedUsers.map((block: any) => (
                  <div key={block.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 font-semibold">
                        {block.blocked?.company_name?.charAt(0) || block.blocked?.full_name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{block.blocked?.company_name || block.blocked?.full_name || t("settings.unknown_user")}</p>
                        <p className="text-sm text-gray-500">
                          {t("settings.blocked_on")} {new Date(block.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Form method="post">
                      <input type="hidden" name="intent" value="unblock" />
                      <input type="hidden" name="blocked_id" value={block.blocked_id} />
                      <button type="submit" className="rounded-full px-3 py-1 text-sm font-medium text-brand-600 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={isUnblocking}>
                        {isUnblocking ? `${t("settings.unblock")}...` : t("settings.unblock")}
                      </button>
                    </Form>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-slate-50 px-4 py-6 text-sm text-gray-500">
                {t("settings.no_blocked_users")}
              </div>
            )}
          </section>

          <section className="mb-6 rounded-3xl border border-gray-200/80 bg-white/95 p-6 shadow-[0_10px_35px_-18px_rgba(15,23,42,0.35)] backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("settings.notifications")}</h2>
            {actionData && "success" in actionData && actionData.action === "notifications_updated" && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-success-50 p-4 text-sm text-success-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Notification settings updated.
              </div>
            )}

            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="update_notifications" />
              <div className="rounded-xl border border-gray-200 bg-slate-50 p-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Lead & Messages</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-700">Info request</p>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" name="info_request" defaultChecked={notificationPrefs.info_request} className="peer sr-only" />
                      <span className="h-5 w-9 rounded-full bg-gray-300 transition peer-checked:bg-brand-500" />
                      <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-700">New message</p>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" name="new_message" defaultChecked={notificationPrefs.new_message} className="peer sr-only" />
                      <span className="h-5 w-9 rounded-full bg-gray-300 transition peer-checked:bg-brand-500" />
                      <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-slate-50 p-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Listing</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-700">Listing status</p>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" name="listing_status" defaultChecked={notificationPrefs.listing_status} className="peer sr-only" />
                      <span className="h-5 w-9 rounded-full bg-gray-300 transition peer-checked:bg-brand-500" />
                      <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-700">Listing expiring</p>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" name="listing_expiring" defaultChecked={notificationPrefs.listing_expiring} className="peer sr-only" />
                      <span className="h-5 w-9 rounded-full bg-gray-300 transition peer-checked:bg-brand-500" />
                      <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-700">Listing pending</p>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" name="listing_pending" defaultChecked={notificationPrefs.listing_pending} className="peer sr-only" />
                      <span className="h-5 w-9 rounded-full bg-gray-300 transition peer-checked:bg-brand-500" />
                      <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-700">Document request / admin action</p>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" name="admin_action" defaultChecked={notificationPrefs.admin_action} className="peer sr-only" />
                      <span className="h-5 w-9 rounded-full bg-gray-300 transition peer-checked:bg-brand-500" />
                      <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-slate-50 p-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Security</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-700">Password/email change</p>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" name="credentials_change" defaultChecked={notificationPrefs.credentials_change} className="peer sr-only" />
                      <span className="h-5 w-9 rounded-full bg-gray-300 transition peer-checked:bg-brand-500" />
                      <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <button type="submit" className="btn-primary rounded-full px-8 text-sm disabled:cursor-not-allowed disabled:opacity-60" disabled={isUpdatingNotifications}>
                  {isUpdatingNotifications ? `${t("profile.actions.save_changes")}...` : t("profile.actions.save_changes")}
                </button>
              </div>
            </Form>
          </section>

          <section className="mb-6 rounded-3xl border border-gray-200/80 bg-white/95 p-6 shadow-[0_10px_35px_-18px_rgba(15,23,42,0.35)] backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("settings.support")}</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">{t("settings.contact_us")}</p>
                  <p className="text-sm text-gray-500">{t("settings.report_problem")}</p>
                </div>
                <Link to="/to-panel/support" className="btn-secondary rounded-full text-sm">
                  {t("settings.contact")}
                </Link>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-gray-900">{t("settings.terms_privacy")}</p>
                  <p className="text-sm text-gray-500">{t("settings.read_terms_privacy")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Link to="/terms-tour-operator" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                    TO addendum
                  </Link>
                  <Link to="/terms" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                    {t("profile.settings.terms")}
                  </Link>
                  <Link to="/privacy-policy" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                    {t("profile.settings.privacy")}
                  </Link>
                </div>
              </div>
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">{t("settings.delete_account")}</p>
                  <p className="text-sm text-gray-500">To delete your account, contact admin support.</p>
                </div>
                <Link to="/to-panel/support" className="btn-secondary rounded-full text-sm">
                  {t("settings.contact")}
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </ControlPanelLayout>
  );
}
