import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  
  if (!user) {
    return json({ unreadCount: 0 });
  }

  const { data: conversations } = await supabaseAdmin
    .from("conversations")
    .select(`
      id,
      messages(id, sender_id, read_at)
    `)
    .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);

  let unreadCount = 0;
  conversations?.forEach((conv: any) => {
    conv.messages?.forEach((msg: any) => {
      if (msg.sender_id !== user.id && !msg.read_at) {
        unreadCount++;
      }
    });
  });

  return json({ unreadCount });
}
