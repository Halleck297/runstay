import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { Form, Link, useLoaderData } from "react-router";
import { useI18n } from "~/hooks/useI18n";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export const meta: MetaFunction = () => {
  return [{ title: "Notifications - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  const { data: notifications } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("user_id", (user as any).id)
    .order("created_at", { ascending: false })
    .limit(50);

  return { user, notifications: notifications || [] };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const actionType = formData.get("_action") as string;

  switch (actionType) {
    case "markRead": {
      const notificationId = formData.get("notificationId") as string;
      await (supabaseAdmin.from("notifications") as any)
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", (user as any).id);
      return data({ success: true });
    }

    case "markAllRead": {
      await (supabaseAdmin.from("notifications") as any)
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", (user as any).id)
        .is("read_at", null);
      return data({ success: true });
    }

    default:
      return data({ error: "unknown_action" }, { status: 400 });
  }
}

const typeIcons: Record<string, { bg: string; icon: string; color: string }> = {
  referral_signup: {
    bg: "bg-brand-100",
    color: "text-brand-600",
    icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
  },
  referral_active: {
    bg: "bg-success-100",
    color: "text-success-600",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  tl_promoted: {
    bg: "bg-purple-100",
    color: "text-purple-600",
    icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
  },
  system: {
    bg: "bg-gray-100",
    color: "text-gray-600",
    icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  listing_approved: {
    bg: "bg-success-100",
    color: "text-success-600",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  listing_rejected: {
    bg: "bg-alert-100",
    color: "text-alert-600",
    icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
};

function timeAgo(dateStr: string, t: (key: any) => string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return t("notifications.just_now");
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${t("notifications.ago")}`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${t("notifications.ago")}`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ${t("notifications.ago")}`;
  return date.toLocaleDateString();
}

export default function Notifications() {
  const { notifications } = useLoaderData<typeof loader>();
  const { t } = useI18n();

  const unreadCount = notifications.filter((n: any) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900 md:text-3xl">{t("notifications.title")}</h1>
          {unreadCount > 0 && <p className="mt-1 text-sm text-gray-500">{unreadCount} {t("notifications.unread")}</p>}
        </div>
        {unreadCount > 0 && (
          <Form method="post">
            <input type="hidden" name="_action" value="markAllRead" />
            <button type="submit" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              {t("notifications.mark_all_read")}
            </button>
          </Form>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="divide-y divide-gray-100">
          {notifications.length > 0 ? (
            notifications.map((notif: any) => {
              const notifData = (notif.data as Record<string, any> | null) || null;
              const isMessageNotification = notif.type === "system" && notifData?.kind === "new_message";
              const typeStyle = isMessageNotification
                ? {
                    bg: "bg-blue-100",
                    color: "text-blue-600",
                    icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z",
                  }
                : typeIcons[notif.type] || typeIcons.system;
              const isUnread = !notif.read_at;

              return (
                <div key={notif.id} className={`flex items-start gap-3 p-4 ${isUnread ? "bg-brand-50/30" : ""}`}>
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${typeStyle.bg}`}>
                    <svg className={`h-4.5 w-4.5 ${typeStyle.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={typeStyle.icon} />
                    </svg>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm ${isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                          {notif.title}
                        </p>
                        <p className="mt-0.5 text-sm text-gray-500">{notif.message}</p>
                        {notifData?.conversation_id ? (
                          <Link to={`/messages?c=${notifData.conversation_id}`} className="mt-1 inline-block text-xs font-medium text-brand-600 hover:text-brand-700">
                            {t("notifications.open_conversation")} →
                          </Link>
                        ) : notifData?.listing_id ? (
                          <Link to={`/listings/${notifData.listing_id}`} className="mt-1 inline-block text-xs font-medium text-brand-600 hover:text-brand-700">
                            {t("notifications.view_listing")} →
                          </Link>
                        ) : null}
                      </div>
                      {isUnread && (
                        <Form method="post" className="flex-shrink-0">
                          <input type="hidden" name="_action" value="markRead" />
                          <input type="hidden" name="notificationId" value={notif.id} />
                          <button type="submit" className="h-2.5 w-2.5 rounded-full bg-brand-500 transition-colors hover:bg-brand-600" title={t("notifications.mark_as_read")} />
                        </Form>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">{timeAgo(notif.created_at, t)}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center">
              <svg className="mx-auto mb-3 h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="text-sm text-gray-500">{t("notifications.empty")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
