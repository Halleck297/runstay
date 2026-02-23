import { supabaseAdmin } from "~/lib/supabase.server";

const EVENT_STATUS_KIND = "tl_event_status_update";
const EVENT_MESSAGE_KIND = "tl_event_message";

export type TlEventNotificationSummary = {
  totalUnread: number;
  messageUnreadByRequest: Record<string, number>;
  statusUnreadByRequest: Record<string, number>;
};

export async function getTlEventNotificationSummary(userId: string): Promise<TlEventNotificationSummary> {
  const { data: rows } = await supabaseAdmin
    .from("notifications")
    .select("id, data")
    .eq("user_id", userId)
    .is("read_at", null);

  const summary: TlEventNotificationSummary = {
    totalUnread: 0,
    messageUnreadByRequest: {},
    statusUnreadByRequest: {},
  };

  for (const row of rows || []) {
    const payload = (row as any)?.data as Record<string, any> | null;
    const kind = String(payload?.kind || "");
    const requestId = String(payload?.event_request_id || "");
    if (!requestId) continue;
    if (kind !== EVENT_STATUS_KIND && kind !== EVENT_MESSAGE_KIND) continue;

    summary.totalUnread += 1;
    if (kind === EVENT_MESSAGE_KIND) {
      summary.messageUnreadByRequest[requestId] = (summary.messageUnreadByRequest[requestId] || 0) + 1;
    } else if (kind === EVENT_STATUS_KIND) {
      summary.statusUnreadByRequest[requestId] = (summary.statusUnreadByRequest[requestId] || 0) + 1;
    }
  }

  return summary;
}

