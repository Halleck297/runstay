import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const listingId = formData.get("listingId") as string;
  const actionType = formData.get("action") as string;

  if (!listingId) {
    return json({ error: "Missing listing ID" }, { status: 400 });
  }

  const userId = (user as any).id as string;

  if (actionType === "save") {
    const { error } = await (supabaseAdmin as any)
      .from("saved_listings")
      .insert({
        user_id: userId,
        listing_id: listingId,
      });

    if (error && error.code !== "23505") {
      return json({ error: "Failed to save listing" }, { status: 500 });
    }

    return json({ saved: true });
  }

  if (actionType === "unsave") {
    const { error } = await (supabaseAdmin as any)
      .from("saved_listings")
      .delete()
      .eq("user_id", userId)
      .eq("listing_id", listingId);

    if (error) {
      return json({ error: "Failed to unsave listing" }, { status: 500 });
    }

    return json({ saved: false });
  }

  return json({ error: "Invalid action" }, { status: 400 });
}
