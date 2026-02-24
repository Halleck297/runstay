import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { getUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  
  if (!user) {
    return data({
      unreadCount: 0,
      unreadMessages: 0,
      unreadNotifications: 0,
    });
  }

  const userId = (user as any).id as string;

  const convResult = await supabaseAdmin
    .from("conversations")
    .select(`
      id,
      messages(id, sender_id, read_at)
    `)
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);

  let unreadMessages = 0;
  convResult.data?.forEach((conv: any) => {
    conv.messages?.forEach((msg: any) => {
      if (msg.sender_id !== userId && !msg.read_at) {
        unreadMessages++;
      }
    });
  });

  return data({
    unreadCount: unreadMessages,
    unreadMessages,
    unreadNotifications: 0,
  });
}
