import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { getUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  
  if (!user) {
    return data({ unreadCount: 0 });
  }

  const userId = (user as any).id as string;

  const { data: conversations } = await supabaseAdmin
    .from("conversations")
    .select(`
      id,
      messages(id, sender_id, read_at)
    `)
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);

  let unreadCount = 0;
  conversations?.forEach((conv: any) => {
    conv.messages?.forEach((msg: any) => {
      if (msg.sender_id !== userId && !msg.read_at) {
        unreadCount++;
      }
    });
  });

  return data({ unreadCount });
}
