import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { supabaseAdmin } from "~/lib/supabase.server";
import { sendTelegram, verifyWebhookSecret } from "~/lib/telegram.server";

// Called by Supabase webhook on messages INSERT
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return data({ error: "Method not allowed" }, { status: 405 });
  if (!verifyWebhookSecret(request)) return data({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const record = body?.record;
  if (!record?.conversation_id || !record?.sender_id) return data({ ok: true });

  // Get conversation participants
  const { data: conv } = await supabaseAdmin
    .from("conversations")
    .select("id, short_id, participant_1, participant_2")
    .eq("id", record.conversation_id)
    .single();
  if (!conv) return data({ ok: true });

  const recipientId = conv.participant_1 === record.sender_id ? conv.participant_2 : conv.participant_1;

  // Check if recipient is a mock user
  const { data: mockRow } = await (supabaseAdmin as any)
    .from("admin_managed_accounts")
    .select("user_id, created_by_admin")
    .eq("user_id", recipientId)
    .in("access_mode", ["internal_only", "external_password"])
    .maybeSingle();
  if (!mockRow) return data({ ok: true });

  // Get sender name
  const { data: sender } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", record.sender_id)
    .single();

  const senderLabel = sender?.full_name || sender?.email || "Unknown";
  const content = record.message_type === "heart" ? "❤️ Listing saved" : (record.content || "—");
  const shortContent = content.length > 200 ? content.slice(0, 200) + "…" : content;
  const ownerAdminId = (mockRow as any).created_by_admin as string | null | undefined;
  const conversationKey = (conv as any).short_id || conv.id;

  if (ownerAdminId && ownerAdminId !== record.sender_id) {
    let shouldInsertNotification = true;

    if (record.id) {
      const { data: existingNotification } = await (supabaseAdmin.from("notifications") as any)
        .select("id")
        .eq("user_id", ownerAdminId)
        .eq("type", "system")
        .filter("data->>kind", "eq", "mock_user_new_message")
        .filter("data->>message_id", "eq", record.id)
        .limit(1)
        .maybeSingle();

      shouldInsertNotification = !existingNotification;
    }

    if (shouldInsertNotification) {
      const { error: notificationError } = await (supabaseAdmin.from("notifications") as any).insert({
        user_id: ownerAdminId,
        type: "system",
        title: "New message for your mock user",
        message: "A mock account managed by you received a new conversation message.",
        data: {
          kind: "mock_user_new_message",
          conversation_id: conversationKey,
          message_id: record.id || null,
          mock_user_id: recipientId,
        },
      });

      if (notificationError) {
        console.error("[mock_user_new_message] notification failed:", notificationError);
      }
    }
  }

  await sendTelegram(
    `💬 <b>New message to mock user</b>\n\n` +
    `<b>From:</b> ${senderLabel}\n` +
    `<b>Message:</b> ${shortContent}\n\n` +
    `<a href="https://www.runoot.com/admin/users">→ Admin Users</a>`
  );

  return data({ ok: true });
}

export async function loader() {
  return data({ error: "Not found" }, { status: 404 });
}
