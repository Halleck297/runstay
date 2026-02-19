// app/routes/notifications.tsx - Notifications page
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { useLoaderData, Form, Link } from "react-router";
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
      return data({ error: "Unknown action" }, { status: 400 });
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

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function Notifications() {
  const { notifications } = useLoaderData<typeof loader>();

  const unreadCount = notifications.filter((n: any) => !n.read_at).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-1">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Form method="post">
            <input type="hidden" name="_action" value="markAllRead" />
            <button type="submit" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              Mark all read
            </button>
          </Form>
        )}
      </div>

      {/* Notifications list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                <div
                  key={notif.id}
                  className={`p-4 flex items-start gap-3 ${isUnread ? "bg-brand-50/30" : ""}`}
                >
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-full ${typeStyle.bg} flex items-center justify-center flex-shrink-0`}>
                    <svg className={`w-4.5 h-4.5 ${typeStyle.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={typeStyle.icon} />
                    </svg>
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm ${isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                          {notif.title}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">{notif.message}</p>
                        {notifData?.conversation_id ? (
                          <Link
                            to={`/messages?c=${notifData.conversation_id}`}
                            className="text-xs text-brand-600 hover:text-brand-700 font-medium mt-1 inline-block"
                          >
                            Open conversation →
                          </Link>
                        ) : notifData?.listing_id ? (
                          <Link
                            to={`/listings/${notifData.listing_id}`}
                            className="text-xs text-brand-600 hover:text-brand-700 font-medium mt-1 inline-block"
                          >
                            View listing →
                          </Link>
                        ) : null}
                      </div>
                      {isUnread && (
                        <Form method="post" className="flex-shrink-0">
                          <input type="hidden" name="_action" value="markRead" />
                          <input type="hidden" name="notificationId" value={notif.id} />
                          <button
                            type="submit"
                            className="w-2.5 h-2.5 rounded-full bg-brand-500 hover:bg-brand-600 transition-colors"
                            title="Mark as read"
                          />
                        </Form>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(notif.created_at)}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="text-sm text-gray-500">No notifications yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
