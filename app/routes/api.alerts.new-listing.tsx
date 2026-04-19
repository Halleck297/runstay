import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { supabaseAdmin } from "~/lib/supabase.server";
import { sendTelegram, verifyWebhookSecret } from "~/lib/telegram.server";

const LISTING_TYPE_LABEL: Record<string, string> = {
  room: "Room",
  bib: "Bib",
  room_and_bib: "Room + Bib",
};

// Called by Supabase webhook on listings INSERT
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return data({ error: "Method not allowed" }, { status: 405 });
  if (!verifyWebhookSecret(request)) return data({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const record = body?.record;
  if (!record?.id || record?.status !== "pending") return data({ ok: true });

  // Get author profile
  const { data: author } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email, company_name")
    .eq("id", record.author_id)
    .single();

  const authorLabel = author?.full_name || author?.company_name || author?.email || "Unknown";
  const typeLabel = LISTING_TYPE_LABEL[record.listing_type] || record.listing_type;

  await sendTelegram(
    `📋 <b>New listing pending approval</b>\n\n` +
    `<b>Title:</b> ${record.title || "—"}\n` +
    `<b>Type:</b> ${typeLabel}\n` +
    `<b>Author:</b> ${authorLabel}\n\n` +
    `<a href="https://www.runoot.com/admin/listings">→ Review listing</a>`
  );

  return data({ ok: true });
}

export async function loader() {
  return data({ error: "Not found" }, { status: 404 });
}
