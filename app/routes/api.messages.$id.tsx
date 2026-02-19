import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { applyConversationPublicIdFilter } from "~/lib/conversation.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const userId = (user as any).id as string;
  const publicConversationId = params.id;

  if (!publicConversationId) {
    return data({ messages: [] }, { status: 400 });
  }

  // Verify user is participant
  const conversationQuery = supabaseAdmin
    .from("conversations")
    .select("id, participant_1, participant_2");
  const { data: conversation } = await applyConversationPublicIdFilter(
    conversationQuery as any,
    publicConversationId
  ).single();

  if (!conversation ||
      (conversation.participant_1 !== userId && conversation.participant_2 !== userId)) {
    return data({ messages: [] }, { status: 403 });
  }

  // Get all messages for this conversation
  const { data: messages, error } = await supabaseAdmin
    .from("messages")
    .select("id, conversation_id, sender_id, content, created_at, read_at, message_type")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching messages:", error);
    return data({ messages: [] }, { status: 500 });
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

  return data({ messages: messages || [] });
}
