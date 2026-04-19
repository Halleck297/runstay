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
    .select("participant_1, participant_2")
    .eq("id", record.conversation_id)
    .single();
  if (!conv) return data({ ok: true });

  const recipientId = conv.participant_1 === record.sender_id ? conv.participant_2 : conv.participant_1;

  // Check if recipient is a mock user
  const { data: mockRow } = await (supabaseAdmin as any)
    .from("admin_managed_accounts")
    .select("user_id")
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
