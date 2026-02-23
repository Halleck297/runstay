import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { applyConversationPublicIdFilter } from "~/lib/conversation.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const userId = (user as any).id as string;
  const publicConversationId = params.id;
  const url = new URL(request.url);
  const beforeParam = url.searchParams.get("before");
  const limitParam = Number(url.searchParams.get("limit") || 50);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;

  if (!publicConversationId) {
    return data({ messages: [], conversationId: null }, { status: 400 });
  }

  // Verify user is participant
  const conversationQuery = supabaseAdmin
    .from("conversations")
    .select("id, participant_1, participant_2, deleted_by_1, deleted_by_2");
  const { data: conversation } = await applyConversationPublicIdFilter(
    conversationQuery as any,
    publicConversationId
  ).single();

  if (!conversation ||
      (conversation.participant_1 !== userId && conversation.participant_2 !== userId)) {
    return data({ messages: [], conversationId: null }, { status: 403 });
  }

  const isDeletedForCurrentUser =
    (conversation.participant_1 === userId && conversation.deleted_by_1) ||
    (conversation.participant_2 === userId && conversation.deleted_by_2);
  if (isDeletedForCurrentUser) {
    return data({ messages: [], conversationId: null }, { status: 404 });
  }

  // Get all messages for this conversation
  let query = supabaseAdmin
    .from("messages")
    .select("id, conversation_id, sender_id, content, created_at, read_at, message_type, detected_language, translated_content, translated_to")
    .eq("conversation_id", conversation.id);

  if (beforeParam) {
    query = query.lt("created_at", beforeParam);
  }

  const { data: messagesRaw, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching messages:", error);
    return data({ messages: [], conversationId: conversation.id }, { status: 500 });
  }

  const messages = [...(messagesRaw || [])].sort(
    (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Mark unread messages as read
  const unreadIds = beforeParam
    ? []
    : messages
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

  let hasOlderMessages = false;
  if (messages.length > 0) {
    const oldestMessageAt = messages[0].created_at;
    const { count: olderCount } = await supabaseAdmin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversation.id)
      .lt("created_at", oldestMessageAt);
    hasOlderMessages = (olderCount || 0) > 0;
  }

  return data({ messages: messages || [], hasOlderMessages, conversationId: conversation.id });
}
