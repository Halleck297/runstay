import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { useRef, useEffect } from "react";
import { requireUser } from "~/lib/session.server";
import { supabase, supabaseAdmin } from "~/lib/supabase.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [{ title: `Contact Seller - ${(data as any)?.listing?.event?.name || "Runoot"}` }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const userId = (user as any).id as string;
  const { id } = params;

  // Get the listing with author and event info
  const { data: listing, error } = await supabase
    .from("listings")
    .select(`
      *,
      author:profiles(id, full_name, company_name, user_type, is_verified),
      event:events(id, name, slug, country, event_date)
    `)
    .eq("id", id!)
    .single();

  if (error || !listing) {
    throw new Response("Listing not found", { status: 404 });
  }

  const listingData = listing as any;

  // Can't message yourself
  if (listingData.author_id === userId) {
    return redirect(`/listings/${id}`);
  }

  // Check if we're coming back after a successful send (don't redirect)
  const url = new URL(request.url);
  const sent = url.searchParams.get("sent");

  if (!sent) {
    // Check if conversation already exists
    const { data: existingConversation } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("listing_id", id!)
      .or(
        `and(participant_1.eq.${userId},participant_2.eq.${listingData.author_id}),and(participant_1.eq.${listingData.author_id},participant_2.eq.${userId})`
      )
      .single<{ id: string }>();

    // If conversation exists, redirect to it
    if (existingConversation) {
      return redirect(`/messages/${existingConversation.id}`);
    }
  }

  // Get current user's profile for the greeting
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("full_name, company_name")
    .eq("id", userId)
    .single();

  return { user, listing: listingData, userProfile, sent: !!sent };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const userId = (user as any).id as string;
  const { id } = params;

  const formData = await request.formData();
  const message = formData.get("message");

  if (typeof message !== "string" || !message.trim()) {
    return data({ error: "Message cannot be empty" }, { status: 400 });
  }

  // Get the listing to find the author
  const { data: listing } = await supabaseAdmin
    .from("listings")
    .select("author_id")
    .eq("id", id!)
    .single<{ author_id: string }>();

  if (!listing) {
    return data({ error: "Listing not found" }, { status: 404 });
  }

  if (listing.author_id === userId) {
    return data({ error: "You cannot message yourself" }, { status: 400 });
  }

  // Check if conversation already exists (race condition check)
  const { data: existingConversation } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("listing_id", id!)
    .or(
      `and(participant_1.eq.${userId},participant_2.eq.${listing.author_id}),and(participant_1.eq.${listing.author_id},participant_2.eq.${userId})`
    )
    .single<{ id: string }>();

  if (existingConversation) {
    // Add message to existing conversation
    await supabaseAdmin.from("messages").insert({
      conversation_id: existingConversation.id,
      sender_id: userId,
      content: message.trim(),
      message_type: "user",
    } as any);

    await (supabaseAdmin.from("conversations") as any)
      .update({ updated_at: new Date().toISOString() })
      .eq("id", existingConversation.id);

    // Redirect to same page with sent=true to show success popup
    return redirect(`/listings/${id}/contact?sent=true`);
  }

  // Create new conversation
  const { data: newConversation, error: convError } = await supabaseAdmin
    .from("conversations")
    .insert({
      listing_id: id!,
      participant_1: userId,
      participant_2: listing.author_id,
    } as any)
    .select()
    .single<{ id: string }>();

  if (convError || !newConversation) {
    return data({ error: "Failed to start conversation" }, { status: 500 });
  }

  // Add the first message
  const { error: msgError } = await supabaseAdmin.from("messages").insert({
    conversation_id: newConversation.id,
    sender_id: userId,
    content: message.trim(),
    message_type: "user",
  } as any);

  if (msgError) {
    return data({ error: "Failed to send message" }, { status: 500 });
  }

  // Redirect to same page with sent=true to show success popup
  return redirect(`/listings/${id}/contact?sent=true`);
}

export default function ContactSeller() {
  const { listing, userProfile, sent } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isSubmitting = navigation.state === "submitting";
  const showSuccess = sent;

  // Pre-composed message
  const sellerName = listing.author.company_name || listing.author.full_name?.split(' ')[0] || "there";
  const eventName = listing.event.name;
  const defaultMessage = `Hello ${sellerName}, I'm writing to you about the listing for ${eventName}. `;

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  };

  // Focus and place cursor at end on mount (only if not showing success)
  useEffect(() => {
    if (textareaRef.current && !showSuccess) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
      textareaRef.current.selectionEnd = textareaRef.current.value.length;
      // Trigger resize
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [showSuccess]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Success Popup */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center">
            {/* Success icon */}
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Message Sent!
            </h3>

            <p className="text-gray-600 mb-6">
              The seller will be notified and can reply to your message.
            </p>

            <Link
              to="/listings"
              className="btn-primary w-full py-3 text-base font-semibold rounded-full block text-center"
            >
              Back to Listings
            </Link>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            to={`/listings/${listing.id}`}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="font-display text-lg font-semibold text-gray-900">
            New Message
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Recipient info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold flex-shrink-0">
              {listing.author.company_name?.charAt(0) ||
                listing.author.full_name?.charAt(0) ||
                "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-gray-900 truncate">
                  {listing.author.company_name || listing.author.full_name}
                </p>
                {listing.author.is_verified && (
                  <svg className="h-4 w-4 text-brand-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {listing.author.user_type === "tour_operator" ? "Tour Operator" : "Private Seller"}
              </p>
            </div>
          </div>

          {/* Listing reference */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Regarding: <span className="text-gray-700 font-medium">{listing.event.name}</span>
            </p>
          </div>
        </div>

        {/* Message form */}
        <Form method="post">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <textarea
              ref={textareaRef}
              name="message"
              defaultValue={defaultMessage}
              placeholder="Write your message..."
              required
              rows={4}
              className="w-full px-4 py-4 text-gray-900 placeholder-gray-400 resize-none focus:outline-none min-h-[120px]"
              disabled={isSubmitting || showSuccess}
              onChange={handleTextareaChange}
            />
          </div>

          {actionData && "error" in actionData && actionData.error && (
            <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {actionData.error}
            </div>
          )}

          {/* Send button */}
          <div className="mt-4">
            <button
              type="submit"
              disabled={isSubmitting || showSuccess}
              className="btn-primary w-full py-3.5 text-base font-semibold rounded-full shadow-lg shadow-brand-500/25 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending...
                </span>
              ) : (
                "Send Message"
              )}
            </button>
          </div>
        </Form>

        {/* Tip */}
        <p className="mt-4 text-center text-xs text-gray-500">
          Be clear about what you're looking for. Include any questions about availability or details.
        </p>
      </div>
    </div>
  );
}
