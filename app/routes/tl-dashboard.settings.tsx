import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { teamLeaderNavItems } from "~/components/panelNav";
import { useI18n } from "~/hooks/useI18n";

export const meta: MetaFunction = () => [{ title: "Team Leader Settings - Runoot" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!(user as any).is_team_leader) return redirect("/listings");

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
  if (!(user as any).is_team_leader) {
    return data({ errorKey: "only_team_leader" as const }, { status: 403 });
  }

  const userId = (user as any).id as string;
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const blockedId = String(formData.get("blocked_id") || "");

  if (intent === "unblock" && blockedId) {
    await supabaseAdmin
      .from("blocked_users")
      .delete()
      .eq("blocker_id", userId)
      .eq("blocked_id", blockedId);

    return data({ success: true, messageKey: "settings.unblocked_success" as const });
  }

  return data({ errorKey: "invalid_action" as const }, { status: 400 });
}

export default function TLSettingsPage() {
  const { t } = useI18n();
  const { user, blockedUsers } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | { error?: string; success?: boolean; message?: string; errorKey?: never; messageKey?: never }
    | { errorKey?: "only_team_leader" | "invalid_action"; success?: boolean; error?: never; message?: never; messageKey?: never }
    | { success?: boolean; messageKey?: "settings.unblocked_success"; message?: never; error?: never; errorKey?: never }
    | undefined;
  const actionError =
    actionData?.errorKey ? t(`tl_settings.error.${actionData.errorKey}` as any) : actionData?.error;
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
      }}
      navItems={teamLeaderNavItems}
    >
      <div className="min-h-full bg-gray-50">
        <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8">
          <div className="mb-8">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-900">{t("settings.title")}</h1>
            <p className="text-gray-500">{t("tl_settings.subtitle")}</p>
          </div>

          {actionError && (
            <div className="mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm">{actionError}</div>
          )}
          {actionData?.success && actionMessage && (
            <div className="mb-4 p-3 rounded-lg bg-success-50 text-success-700 text-sm">{actionMessage}</div>
          )}

          <h3 className="font-display font-semibold text-gray-900 text-lg mb-3">{t("settings.account")}</h3>
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-500">{t("settings.email")}</label>
                  <p className="mt-1 text-gray-900 font-medium">{(user as any).email}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-900">{t("settings.change_password")}</label>
                  <p className="text-sm text-gray-500 mt-1">{t("profile.settings.update_password")}</p>
                </div>
                <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                  {t("settings.reset_password")}
                </Link>
              </div>
            </div>
          </div>

          <h3 className="font-display font-semibold text-gray-900 text-lg mb-3">{t("settings.blocked_users")}</h3>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
            {blockedUsers.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {blockedUsers.map((block: any) => (
                  <div key={block.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 font-semibold">
                        {block.blocked?.company_name?.charAt(0) || block.blocked?.full_name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {block.blocked?.company_name || block.blocked?.full_name || t("settings.unknown_user")}
                        </p>
                        <p className="text-sm text-gray-500">
                          {t("settings.blocked_on")} {new Date(block.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Form method="post">
                      <input type="hidden" name="intent" value="unblock" />
                      <input type="hidden" name="blocked_id" value={block.blocked_id} />
                      <button type="submit" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                        {t("settings.unblock")}
                      </button>
                    </Form>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">{t("settings.no_blocked_users")}</p>
            )}
          </div>

          <h3 className="font-display font-semibold text-gray-900 text-lg mb-3">{t("settings.support")}</h3>
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-900">{t("settings.contact_us")}</label>
                  <p className="text-sm text-gray-500 mt-1">{t("settings.report_problem")}</p>
                </div>
                <Link to="/contact" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                  {t("settings.contact")}
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ControlPanelLayout>
  );
}
