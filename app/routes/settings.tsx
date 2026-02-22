import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { useLoaderData, useActionData, Form, Link } from "react-router";
import { useI18n } from "~/hooks/useI18n";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";
import { buildLocaleCookie, isSupportedLocale, LOCALE_LABELS } from "~/lib/locale";
import type { SupportedLocale } from "~/lib/locale";

export const meta: MetaFunction = () => {
  return [{ title: "Settings - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const userId = (user as any).id as string;

  // Get blocked users with their profile info
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
  const country = formData.get("country");
  const language = formData.get("language");

  if (intent === "update_preferences") {
    if (typeof country !== "string" || typeof language !== "string") {
      return data({ error: "Invalid preferences payload" }, { status: 400 });
    }

    const normalizedLanguage = language.toLowerCase() as SupportedLocale;
    if (!isSupportedLocale(normalizedLanguage)) {
      return data({ error: "Invalid language selected" }, { status: 400 });
    }

    const { error } = await (supabaseAdmin.from("profiles") as any)
      .update({
        country: country.trim() || null,
        preferred_language: normalizedLanguage,
      })
      .eq("id", userId);

    if (error) {
      return data({ error: "Unable to update preferences" }, { status: 500 });
    }

    return data(
      { success: true, action: "preferences_updated" },
      {
        headers: {
          "Set-Cookie": buildLocaleCookie(normalizedLanguage),
        },
      }
    );
  }

  if (intent === "unblock" && typeof blockedId === "string") {
    await supabaseAdmin
      .from("blocked_users")
      .delete()
      .eq("blocker_id", userId)
      .eq("blocked_id", blockedId);

    return data({ success: true, action: "unblocked" });
  }

  return data({ error: "Invalid action" }, { status: 400 });
}

export default function Settings() {
  const { t } = useI18n();
  const { user, blockedUsers } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="min-h-full bg-gray-50">
      <Header user={user} />

      <main className="mx-auto max-w-3xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-gray-900 mb-8">
          {t("settings.title")}
        </h1>

        {/* Account Section */}
        <section className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("settings.account")}</h2>

          {actionData && "action" in actionData && actionData.action === "preferences_updated" && (
            <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              {t("settings.preferences_updated")}
            </div>
          )}
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-gray-900">{t("settings.email")}</p>
                <p className="text-sm text-gray-500">{(user as any).email}</p>
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-gray-900">{t("settings.profile")}</p>
                <p className="text-sm text-gray-500">{t("settings.edit_profile_info")}</p>
              </div>
              <Link to="/profile" className="btn-secondary text-sm">
                {t("settings.edit")}
              </Link>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900">{t("settings.password")}</p>
                <p className="text-sm text-gray-500">{t("settings.change_password")}</p>
              </div>
              <Link to="/forgot-password" className="btn-secondary text-sm">
                {t("settings.reset_password")}
              </Link>
            </div>

            <Form method="post" className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <input type="hidden" name="intent" value="update_preferences" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                    {t("settings.country")}
                  </label>
                  <input
                    id="country"
                    name="country"
                    type="text"
                    defaultValue={(user as any).country ?? ""}
                    autoComplete="country-name"
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
                    {t("settings.preferred_language")}
                  </label>
                  <select
                    id="language"
                    name="language"
                    defaultValue={(user as any).preferred_language || "en"}
                    className="input"
                  >
                    {Object.entries(LOCALE_LABELS).map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <button type="submit" className="btn-primary text-sm">
                  {t("settings.save_preferences")}
                </button>
              </div>
            </Form>
          </div>
        </section>

        {/* Blocked Users Section */}
        <section className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("settings.blocked_users")}</h2>
          
          {actionData && "success" in actionData && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg">
              {t("settings.unblocked_success")}
            </div>
          )}

          {blockedUsers.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {blockedUsers.map((block: any) => (
                <div key={block.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 font-semibold">
                      {block.blocked?.company_name?.charAt(0) ||
                        block.blocked?.full_name?.charAt(0) ||
                        "?"}
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
                    <button
                      type="submit"
                      className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                    >
                      {t("settings.unblock")}
                    </button>
                  </Form>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">{t("settings.no_blocked_users")}</p>
          )}
        </section>

        {/* Notifications Section */}
        <section className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("settings.notifications")}</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-gray-900">{t("settings.email_notifications")}</p>
                <p className="text-sm text-gray-500">{t("settings.receive_email_messages")}</p>
              </div>
              <button className="btn-secondary text-sm" disabled>
                {t("settings.coming_soon")}
              </button>
            </div>
          </div>
        </section>

        {/* Support Section */}
        <section className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("settings.support")}</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-gray-900">{t("settings.contact_us")}</p>
                <p className="text-sm text-gray-500">{t("settings.report_problem")}</p>
              </div>
              <Link to="/contact" className="btn-secondary text-sm">
                {t("settings.contact")}
              </Link>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900">{t("settings.terms_privacy")}</p>
                <p className="text-sm text-gray-500">{t("settings.read_terms_privacy")}</p>
              </div>
              <button className="btn-secondary text-sm" disabled>
                {t("settings.coming_soon")}
              </button>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="card p-6 border-red-200">
          <h2 className="text-lg font-semibold text-red-600 mb-4">{t("settings.danger_zone")}</h2>
          
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-gray-900">{t("settings.delete_account")}</p>
              <p className="text-sm text-gray-500">{t("settings.delete_account_text")}</p>
            </div>
            <button className="btn-secondary text-sm text-red-600 border-red-300 hover:bg-red-50" disabled>
              {t("settings.coming_soon")}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
