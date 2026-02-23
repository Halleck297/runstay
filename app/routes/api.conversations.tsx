import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const userId = (user as any).id as string;

  const { data: allConversations, error } = await supabaseAdmin
    .from("conversations")
    .select(
      `
      *,
      listing:listings(id, title, listing_type, author_id),
      participant1:profiles!conversations_participant_1_fkey(id, full_name, company_name, user_type, avatar_url),
      participant2:profiles!conversations_participant_2_fkey(id, full_name, company_name, user_type, avatar_url),
      messages(id, content, sender_id, created_at, read_at, message_type, detected_language, translated_content, translated_to)
    `
    )
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false, foreignTable: "messages" })
    .limit(1, { foreignTable: "messages" });

  if (error) {
    console.error("Error fetching conversations:", error);
    return data({ conversations: [] }, { status: 500 });
  }

  const conversationIds = (allConversations || []).map((conv: any) => conv.id);
  const unreadCountByConversation: Record<string, number> = {};
  if (conversationIds.length > 0) {
    const { data: unreadRows } = await supabaseAdmin
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", conversationIds)
      .neq("sender_id", userId)
      .is("read_at", null);

    for (const row of unreadRows || []) {
      const conversationId = (row as any).conversation_id as string;
      unreadCountByConversation[conversationId] = (unreadCountByConversation[conversationId] || 0) + 1;
    }
  }

  // Filter out non-activated conversations for non-owners
  const conversations = (allConversations || [])
    .filter((conv: any) => {
      const isDeletedForCurrentUser =
        (conv.participant_1 === userId && conv.deleted_by_1) ||
        (conv.participant_2 === userId && conv.deleted_by_2);
      if (isDeletedForCurrentUser) return false;

      if (conv.activated) return true;
      return conv.listing?.author_id === userId;
    })
    .map((conv: any) => ({
      ...conv,
      unread_count: unreadCountByConversation[conv.id] || 0,
    }));

  return data({ conversations: conversations || [] });
}
