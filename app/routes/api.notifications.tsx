// app/routes/api.notifications.tsx - Notifications API (count + mark read)
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { getUserId } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

// GET: return unread notification count
export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await getUserId(request);
  if (!userId) {
    return data({ unreadNotifications: 0 });
  }

  const { count } = await supabaseAdmin
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  return data({ unreadNotifications: count || 0 });
}

// POST: mark notification(s) as read
export async function action({ request }: ActionFunctionArgs) {
  const userId = await getUserId(request);
  if (!userId) {
    return data({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const actionType = formData.get("_action") as string;

  switch (actionType) {
    case "markRead": {
      const notificationId = formData.get("notificationId") as string;
      await (supabaseAdmin.from("notifications") as any)
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", userId);
      return data({ success: true });
    }

    case "markAllRead": {
      await (supabaseAdmin.from("notifications") as any)
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);
      return data({ success: true });
    }

    default:
      return data({ error: "Unknown action" }, { status: 400 });
  }
}
