import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const userId = (user as any).id as string;
  const conversationId = params.id;

  if (!conversationId) {
    return json({ messages: [] }, { status: 400 });
  }

  // Verify user is participant
  const { data: conversation } = await supabaseAdmin
    .from("conversations")
    .select("participant_1, participant_2")
    .eq("id", conversationId)
    .single();

  if (!conversation ||
      (conversation.participant_1 !== userId && conversation.participant_2 !== userId)) {
    return json({ messages: [] }, { status: 403 });
  }

  // Get all messages for this conversation
  const { data: messages, error } = await supabaseAdmin
    .from("messages")
    .select("id, conversation_id, sender_id, content, created_at, read_at, message_type")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching messages:", error);
    return json({ messages: [] }, { status: 500 });
  }

  // Mark unread messages as read
  const unreadIds = messages
    ?.filter(m => m.sender_id !== userId && !m.read_at)
    .map(m => m.id) || [];

  if (unreadIds.length > 0) {
    await supabaseAdmin
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);

    // Update the messages we're returning with read_at
    const now = new Date().toISOString();
    messages?.forEach(m => {
      if (unreadIds.includes(m.id)) {
        m.read_at = now;
      }
    });
  }

  return json({ messages: messages || [] });
}
