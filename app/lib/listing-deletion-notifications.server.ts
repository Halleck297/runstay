import { sendTemplatedEmail } from "~/lib/email/service.server";
import { normalizeEmailLocale } from "~/lib/email/types";
import { supabaseAdmin } from "~/lib/supabase.server";

type ListingDeletionNotificationArgs = {
  listingId: string;
};

function readAuthorName(author: unknown): string {
  if (!author) return "Runoot user";
  if (Array.isArray(author)) return readAuthorName(author[0]);
  if (typeof author === "object") {
    const profile = author as { full_name?: unknown; company_name?: unknown };
    const companyName = typeof profile.company_name === "string" ? profile.company_name.trim() : "";
    const fullName = typeof profile.full_name === "string" ? profile.full_name.trim() : "";
    return companyName || fullName || "Runoot user";
  }
  return "Runoot user";
}

export async function notifyListingDeletionParticipants(args: ListingDeletionNotificationArgs) {
  try {
    const { data: listing } = await (supabaseAdmin as any)
      .from("listings")
      .select("id, title, author_id, status, author:profiles!listings_author_id_fkey(full_name, company_name)")
      .eq("id", args.listingId)
      .maybeSingle();

    if (!listing) return;
    if (listing.status === "deleted") return;

    const { data: conversations } = await (supabaseAdmin as any)
      .from("conversations")
      .select("id, participant_1, participant_2")
      .eq("listing_id", listing.id);

    const conversationRows = conversations || [];
    if (conversationRows.length === 0) return;

    const conversationIds = conversationRows.map((conversation: any) => conversation.id);
    const { data: userMessages } = await (supabaseAdmin as any)
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", conversationIds)
      .eq("message_type", "user");

    const conversationsWithMessages = new Set((userMessages || []).map((message: any) => message.conversation_id));
    if (conversationsWithMessages.size === 0) return;

    const recipientIds = new Set<string>();
    for (const conversation of conversationRows) {
      if (!conversationsWithMessages.has(conversation.id)) continue;
      if (conversation.participant_1 && conversation.participant_1 !== listing.author_id) {
        recipientIds.add(conversation.participant_1);
      }
      if (conversation.participant_2 && conversation.participant_2 !== listing.author_id) {
        recipientIds.add(conversation.participant_2);
      }
    }

    if (recipientIds.size === 0) return;

    const { data: recipients } = await (supabaseAdmin as any)
      .from("profiles")
      .select("id, email, preferred_language")
      .in("id", Array.from(recipientIds));

    const ownerName = readAuthorName(listing.author);
    for (const recipient of recipients || []) {
      if (!recipient.email) continue;

      const result = await sendTemplatedEmail({
        to: recipient.email,
        templateId: "listing_deleted_notification",
        locale: normalizeEmailLocale(recipient.preferred_language),
        payload: {
          listingTitle: listing.title || "Runoot listing",
          ownerName,
        },
      });

      if (result.ok) {
        await (supabaseAdmin.from("email_notification_log") as any).insert({
          template_id: "listing_deleted_notification",
          recipient_id: recipient.id,
        });
      }
    }
  } catch (error) {
    console.error("[listing_deleted_notification] failed:", error);
  }
}
