import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const listingId = formData.get("listingId") as string;
  const actionType = formData.get("action") as string;

  if (!listingId) {
    return data({ error: "Missing listing ID" }, { status: 400 });
  }

  const userId = (user as any).id as string;

  if (actionType === "save") {
    const { data: listing, error: listingError } = await supabaseAdmin
      .from("listings")
      .select("author_id, status")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError || !listing) {
      return data({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.author_id === userId) {
      return data({ error: "You cannot save your own listing" }, { status: 403 });
    }

    if (listing.status !== "active") {
      return data({ error: "Only active listings can be saved" }, { status: 409 });
    }

    // Save the listing
    const { error } = await (supabaseAdmin as any)
      .from("saved_listings")
      .insert({
        user_id: userId,
        listing_id: listingId,
      });

    if (error && error.code !== "23505") {
      return data({ error: "Failed to save listing" }, { status: 500 });
    }

    // Check if conversation already exists
    const { data: existingConv } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("listing_id", listingId)
      .or(`and(participant_1.eq.${userId},participant_2.eq.${listing.author_id}),and(participant_1.eq.${listing.author_id},participant_2.eq.${userId})`)
      .single();

    if (!existingConv) {
      // Create a new conversation (not activated - only visible to owner)
      const { data: newConv, error: convError } = await (supabaseAdmin as any)
        .from("conversations")
        .insert({
          listing_id: listingId,
          participant_1: userId, // The person who saved
          participant_2: listing.author_id, // The listing owner
          activated: false, // Hidden from participant_1 until owner replies
        })
        .select()
        .single();

      if (newConv && !convError) {
        // Create the heart system message
        await (supabaseAdmin as any)
          .from("messages")
          .insert({
            conversation_id: newConv.id,
            sender_id: userId, // The person who saved
            content: "HEART_NOTIFICATION",
            message_type: "heart",
          });
      }
    }

    return data({ saved: true });
  }

  if (actionType === "unsave") {
    const { error } = await (supabaseAdmin as any)
      .from("saved_listings")
      .delete()
      .eq("user_id", userId)
      .eq("listing_id", listingId);

    if (error) {
      return data({ error: "Failed to unsave listing" }, { status: 500 });
    }

    return data({ saved: false });
  }

  return data({ error: "Invalid action" }, { status: 400 });
}
