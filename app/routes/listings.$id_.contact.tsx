import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { useEffect, useRef } from "react";
import { useI18n } from "~/hooks/useI18n";
import { localizeListing, resolveLocaleForRequest } from "~/lib/locale";
import { applyListingPublicIdFilter, getListingPublicId } from "~/lib/publicIds";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { sendToUnifiedNotificationEmail } from "~/lib/to-notifications.server";
import { getPublicDisplayName, getPublicInitial } from "~/lib/user-display";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [{ title: `Contact Seller - ${(data as any)?.listing?.event?.name || "Runoot"}` }];
};

type ContactActionData =
  | { errorKey: "empty_message" | "listing_not_found" | "message_yourself" | "failed_start" | "failed_send" }
  | undefined;

async function resolveConversationRecipient(args: { listing: any }) {
  const listing = args.listing;
  const listingPublicId = getListingPublicId(listing as any);

  const { data: eventReq } = await (supabaseAdmin as any)
    .from("event_requests")
    .select("team_leader_id")
    .ilike("published_listing_url", `%/listings/${listingPublicId}`)
    .maybeSingle();

  if (eventReq?.team_leader_id) {
    const { data: tlProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, company_name, user_type, is_verified, avatar_url")
      .eq("id", eventReq.team_leader_id)
      .maybeSingle();

    if (tlProfile) {
      return {
        recipientId: tlProfile.id,
        recipientProfile: tlProfile,
      };
    }
  }

  return {
    recipientId: listing.author_id as string,
    recipientProfile: listing.author,
  };
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const locale = resolveLocaleForRequest(request, (user as any)?.preferred_language);
  const userId = (user as any).id as string;
  const { id } = params;

  const listingQuery = supabaseAdmin
    .from("listings")
    .select(`
      *,
      title_i18n,
      author:profiles!listings_author_id_fkey(id, full_name, company_name, user_type, is_verified, avatar_url),
      event:events(id, name, name_i18n, slug, country, country_i18n, event_date, card_image_url)
    `);
  const { data: rawListing, error } = await applyListingPublicIdFilter(listingQuery as any, id!).single();

  if (error || !rawListing) {
    throw new Response("Listing not found", { status: 404 });
  }

  const listing = localizeListing(rawListing as any, locale) as any;

  const recipient = await resolveConversationRecipient({ listing });

  if (recipient.recipientId === userId) {
    return redirect(`/listings/${getListingPublicId(listing)}`);
  }

  const url = new URL(request.url);
  const sent = url.searchParams.get("sent");

  if (!sent) {
    const { data: existingConversation } = await supabaseAdmin
      .from("conversations")
      .select("id, short_id")
      .eq("listing_id", listing.id)
      .or(
        `and(participant_1.eq.${userId},participant_2.eq.${recipient.recipientId}),and(participant_1.eq.${recipient.recipientId},participant_2.eq.${userId})`
      )
      .single<{ id: string; short_id: string | null }>();

    if (existingConversation) {
      return redirect(`/messages?c=${existingConversation.short_id || existingConversation.id}`);
    }
  }

  const { data: userProfile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, company_name")
    .eq("id", userId)
    .single();

  return {
    user,
    listing,
    recipientProfile: recipient.recipientProfile,
    recipientId: recipient.recipientId,
    userProfile,
    sent: !!sent,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const userId = (user as any).id as string;
  const { id } = params;

  const formData = await request.formData();
  const message = formData.get("message");

  if (typeof message !== "string" || !message.trim()) {
    return data<ContactActionData>({ errorKey: "empty_message" }, { status: 400 });
  }

  const listingQuery = supabaseAdmin
    .from("listings")
    .select("id, author_id, author:profiles!listings_author_id_fkey(id, full_name, company_name, user_type, is_verified, avatar_url)");
  const { data: listing } = await applyListingPublicIdFilter(listingQuery as any, id!).single();

  if (!listing) {
    return data<ContactActionData>({ errorKey: "listing_not_found" }, { status: 404 });
  }

  const recipient = await resolveConversationRecipient({ listing });

  if (recipient.recipientId === userId) {
    return data<ContactActionData>({ errorKey: "message_yourself" }, { status: 400 });
  }

  const { data: existingConversation } = await supabaseAdmin
    .from("conversations")
    .select("id, short_id")
    .eq("listing_id", listing.id)
    .or(
      `and(participant_1.eq.${userId},participant_2.eq.${recipient.recipientId}),and(participant_1.eq.${recipient.recipientId},participant_2.eq.${userId})`
    )
    .single<{ id: string; short_id: string | null }>();

  if (existingConversation) {
    await supabaseAdmin.from("messages").insert({
      conversation_id: existingConversation.id,
      sender_id: userId,
      content: message.trim(),
      message_type: "user",
    } as any);

    await (supabaseAdmin.from("conversations") as any)
      .update({ updated_at: new Date().toISOString() })
      .eq("id", existingConversation.id);

    await sendToUnifiedNotificationEmail({
      userId: recipient.recipientId,
      prefKey: "info_request",
      message: "You received a new info request on one of your listings.",
      ctaUrl: `/messages?c=${existingConversation.short_id || existingConversation.id}`,
    });

    return redirect(`/listings/${getListingPublicId(listing as any)}/contact?sent=true`);
  }

  const { data: newConversation, error: convError } = await supabaseAdmin
    .from("conversations")
    .insert({
      listing_id: listing.id,
      participant_1: userId,
      participant_2: recipient.recipientId,
    } as any)
    .select("id, short_id")
    .single<{ id: string; short_id: string | null }>();

  if (convError || !newConversation) {
    return data<ContactActionData>({ errorKey: "failed_start" }, { status: 500 });
  }

  const { error: msgError } = await supabaseAdmin.from("messages").insert({
    conversation_id: newConversation.id,
    sender_id: userId,
    content: message.trim(),
    message_type: "user",
  } as any);

  if (msgError) {
    return data<ContactActionData>({ errorKey: "failed_send" }, { status: 500 });
  }

  await sendToUnifiedNotificationEmail({
    userId: recipient.recipientId,
    prefKey: "info_request",
    message: "You received a new info request on one of your listings.",
    ctaUrl: `/messages?c=${newConversation.short_id || newConversation.id}`,
  });

  return redirect(`/listings/${getListingPublicId(listing as any)}/contact?sent=true`);
}

export default function ContactSeller() {
  const { listing, recipientProfile, sent } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useI18n();

  const isSubmitting = navigation.state === "submitting";
  const showSuccess = sent;

  const sellerName = getPublicDisplayName(recipientProfile) || t("contact_seller.seller_fallback");
  const eventName = listing.event.name;
  const defaultMessage = `${t("contact_seller.greeting_prefix")} ${sellerName}, ${t("contact_seller.greeting_about")} ${eventName}. `;

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  useEffect(() => {
    if (textareaRef.current && !showSuccess) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
      textareaRef.current.selectionEnd = textareaRef.current.value.length;
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [showSuccess]);

  const errorText = actionData?.errorKey
    ? {
        empty_message: t("contact_seller.error.empty_message"),
        listing_not_found: t("contact_seller.error.listing_not_found"),
        message_yourself: t("contact_seller.error.message_yourself"),
        failed_start: t("contact_seller.error.failed_start"),
        failed_send: t("contact_seller.error.failed_send"),
      }[actionData.errorKey]
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h3 className="mb-2 text-xl font-semibold text-gray-900">{t("contact_seller.success.title")}</h3>
            <p className="mb-6 text-gray-600">{t("contact_seller.success.body")}</p>

            <Link to="/listings" className="btn-primary block w-full rounded-full py-3 text-center text-base font-semibold">
              {t("contact_seller.success.back_listings")}
            </Link>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-4">
          <Link to={`/listings/${getListingPublicId(listing)}`} className="text-gray-400 hover:text-gray-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="font-display text-lg font-semibold text-gray-900">{t("contact_seller.new_message")}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-semibold text-brand-700">
              {recipientProfile.avatar_url ? (
                <img
                  src={recipientProfile.avatar_url}
                  alt={getPublicDisplayName(recipientProfile)}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                getPublicInitial(recipientProfile)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate font-semibold text-gray-900">
                  {getPublicDisplayName(recipientProfile)}
                </p>
                {recipientProfile.is_verified && (
                  <svg className="h-4 w-4 flex-shrink-0 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {recipientProfile.user_type === "tour_operator" ? t("common.tour_operator") : t("contact_seller.private_seller")}
              </p>
            </div>
          </div>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="text-sm text-gray-500">
              {t("contact_seller.regarding")} <span className="font-medium text-gray-700">{listing.event.name}</span>
            </p>
          </div>
        </div>

        <Form method="post">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <textarea
              ref={textareaRef}
              name="message"
              defaultValue={defaultMessage}
              placeholder={t("contact_seller.placeholder")}
              required
              rows={4}
              className="min-h-[120px] w-full resize-none px-4 py-4 text-gray-900 placeholder-gray-400 focus:outline-none"
              disabled={isSubmitting || showSuccess}
              onChange={handleTextareaChange}
            />
          </div>

          {errorText && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorText}</div>}

          <div className="mt-4">
            <button
              type="submit"
              disabled={isSubmitting || showSuccess}
              className="btn-primary w-full rounded-full py-3.5 text-base font-semibold shadow-lg shadow-brand-500/25 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t("contact.sending")}
                </span>
              ) : (
                t("contact_seller.send")
              )}
            </button>
          </div>
        </Form>

        <p className="mt-4 text-center text-xs text-gray-500">{t("contact_seller.tip")}</p>
      </div>
    </div>
  );
}
