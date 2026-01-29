import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData, useLoaderData, useFetcher } from "react-router";
import { useState } from "react";
import { getUser } from "~/lib/session.server";
import { supabase, supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [{ title: (data as any)?.listing?.title || "Listing - Runoot" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getUser(request);
  const { id } = params;

  const { data: listing, error } = await supabase
    .from("listings")
    .select(
      `
      *,
      author:profiles(id, full_name, company_name, user_type, is_verified, email),
      event:events(id, name, slug, country, event_date)
    `
    )
    .eq("id", id!)
    .single();

  if (error || !listing) {
    throw new Response("Listing not found", { status: 404 });
  }

  // Check if user has saved this listing
  let isSaved = false;
  if (user) {
    const userId = (user as any).id as string;
    const { data: savedListing } = await (supabase as any)
      .from("saved_listings")
      .select("id")
      .eq("user_id", userId)
      .eq("listing_id", id!)
      .single();
    
    isSaved = !!savedListing;
  }

  return { user, listing, isSaved };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect(`/login?redirectTo=/listings/${params.id}`);
  }

  const userId = (user as any).id as string;
  const { id } = params;

  const formData = await request.formData();
  const actionType = formData.get("_action") as string;

  // Get the listing to find the author
  const { data: listing } = await supabaseAdmin
    .from("listings")
    .select("author_id")
    .eq("id", id!)
    .single<{ author_id: string }>();

  if (!listing) {
    return data({ error: "Listing not found" }, { status: 404 });
  }

  // Handle delete action
  if (actionType === "delete") {
    if (listing.author_id !== userId) {
      return data({ error: "Unauthorized" }, { status: 403 });
    }

    // Get user type to determine redirect destination
    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("user_type")
      .eq("id", userId)
      .single<{ user_type: string }>();

    const { error } = await supabaseAdmin
      .from("listings")
      .delete()
      .eq("id", id!);

    if (error) {
      return data({ error: "Failed to delete listing" }, { status: 500 });
    }

    // Redirect based on user type
    const redirectPath = userProfile?.user_type === "tour_operator" ? "/dashboard" : "/my-listings";
    return redirect(redirectPath);
  }

  // Handle contact action (default)
  if (listing.author_id === userId) {
    return data({ error: "You cannot message yourself" }, { status: 400 });
  }

  // Check if conversation already exists
  const { data: existingConversation } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("listing_id", id!)
    .or(
      `and(participant_1.eq.${userId},participant_2.eq.${listing.author_id}),and(participant_1.eq.${listing.author_id},participant_2.eq.${userId})`
    )
    .single<{ id: string }>();

  if (existingConversation) {
    return redirect(`/messages/${existingConversation.id}`);
  }

  // Create new conversation
  const { data: newConversation, error } = await supabaseAdmin
    .from("conversations")
    .insert({
      listing_id: id!,
      participant_1: userId,
      participant_2: listing.author_id,
    } as any)
    .select()
    .single<{ id: string }>();

  if (error) {
    return data({ error: "Failed to start conversation" }, { status: 500 });
  }

  return redirect(`/messages/${newConversation.id}`);
}

const typeLabels = {
  room: "Room only",
  bib: "Bib only",
  room_and_bib: "Package",
};

const typeColors = {
  room: "bg-blue-100 text-blue-700 border-blue-200",
  bib: "bg-purple-100 text-purple-700 border-purple-200",
  room_and_bib: "bg-green-100 text-green-700 border-green-200",
};

// Helper per formattare room type
function formatRoomType(roomType: string | null): string {
  if (!roomType) return "Room";
  
  const labels: Record<string, string> = {
    single: "Single",
    double: "Double",
    double_single_use: "Double Single Use",
    twin: "Twin",
    twin_shared: "Twin Shared",
    triple: "Triple",
    quadruple: "Quadruple"
  };
  
  return labels[roomType] || roomType;
}

// Helper per calcolare giorni mancanti
function getDaysUntilEvent(eventDate: string): number {
  const today = new Date();
  const event = new Date(eventDate);
  const diffTime = event.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Helper: genera slug dal nome evento (fallback se slug è null)
function getEventSlug(event: { name: string; slug: string | null }): string {
  if (event.slug) return event.slug;
  return event.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function ListingDetail() {
  const { user, listing, isSaved } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [showSafety, setShowSafety] = useState(false);
  const saveFetcher = useFetcher();
  const isSavedOptimistic = saveFetcher.formData
    ? saveFetcher.formData.get("action") === "save"
    : isSaved;
  
  const listingData = listing as any;
  const userData = user as any;
  
  const eventDate = new Date(listingData.event.event_date);
  const eventDateFormatted = eventDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  
  const eventDateShort = eventDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const isOwner = userData?.id === listingData.author_id;
  const daysUntil = getDaysUntilEvent(listingData.event.event_date);

  // Genera sottotitolo contestuale
  let subtitle = "";
  if (listingData.listing_type === "room") {
    const nights = listingData.check_in && listingData.check_out 
      ? Math.ceil((new Date(listingData.check_out).getTime() - new Date(listingData.check_in).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    subtitle = `${formatRoomType(listingData.room_type)} · ${nights > 0 ? `${nights} nights` : "Race weekend"}`;
  } else if (listingData.listing_type === "bib") {
    subtitle = `${listingData.bib_count || 1} bib${(listingData.bib_count || 1) > 1 ? "s" : ""} available`;
  } else {
    subtitle = "Complete race weekend package";
  }

  // Price anchor (stima comparativa)
  const priceAnchor = listingData.hotel_stars 
    ? `Comparable ${listingData.hotel_stars}-star hotels from €${Math.round((listingData.hotel_stars * 80) + 100)}`
    : "Comparable hotels from €200+";

  return (
    <div className="min-h-full bg-gray-50">
      <Header user={user} />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          to="/listings"
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 mb-6"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to listings
        </Link>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content - 2 colonne */}
          <div className="lg:col-span-2 space-y-6">

            {/* Event Image */}
            <div className="relative rounded-xl overflow-hidden shadow-lg">
              <img
                src={`/events/${getEventSlug(listingData.event)}.jpg`}
                alt={listingData.event.name}
                className="w-full aspect-video object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="w-full aspect-video bg-gradient-to-br from-brand-100 to-brand-200 items-center justify-center" style={{ display: 'none' }}>
                <svg className="h-16 w-16 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>

            {/* Details - Hotel & Location */}
            {(listingData.listing_type === "room" || listingData.listing_type === "room_and_bib") && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-display text-lg font-semibold text-gray-900 mb-4">
                  Hotel & Location
                </h3>

                <div className="space-y-5">
                  {/* Hotel info block */}
                  {listingData.hotel_name && (
                    <div>
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 flex-shrink-0">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-500 mb-1">Hotel</p>
                          <p className="font-semibold text-gray-900">
                            {listingData.hotel_website ? (
                              <a
                                href={listingData.hotel_website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-brand-600 hover:text-brand-700 hover:underline inline-flex items-center gap-1"
                              >
                                {listingData.hotel_name}
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            ) : (
                              listingData.hotel_name
                            )}
                          </p>
                          {(listingData.hotel_city || listingData.hotel_country) && (
                            <p className="text-sm text-gray-600 mt-0.5">
                              📍 {listingData.hotel_city || ""}{listingData.hotel_city && listingData.hotel_country ? ", " : ""}{listingData.hotel_country || ""}
                            </p>
                          )}
                          {listingData.hotel_rating && (
                            <p className="text-sm text-gray-600 mt-1">
                              ⭐ {listingData.hotel_rating.toFixed(1)} rating
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Room details */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 flex-shrink-0">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 mb-1">Accommodation</p>
                      <p className="font-semibold text-gray-900">
                        {listingData.room_count || 1} {formatRoomType(listingData.room_type)} room{(listingData.room_count || 1) > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Check-in/out */}
                  {listingData.check_in && listingData.check_out && (() => {
                    const checkIn = new Date(listingData.check_in);
                    const checkOut = new Date(listingData.check_out);
                    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 flex-shrink-0">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-500 mb-1">Dates</p>
                          <p className="font-semibold text-gray-900">
                            {checkIn.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} → {checkOut.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {nights} night{nights > 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Why this listing - Value propositions */}
            {(listingData.listing_type === "room" || listingData.listing_type === "room_and_bib") && listingData.hotel_name && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-display text-lg font-semibold text-gray-900 mb-4">
                  Why this stay
                </h3>
                <div className="space-y-2.5">
                  {listingData.hotel_rating && listingData.hotel_rating >= 4 && (
                    <div className="flex items-start gap-3">
                      <svg className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">
                        Top-rated hotel (⭐ {listingData.hotel_rating.toFixed(1)} on Google)
                      </span>
                    </div>
                  )}
                  {listingData.hotel_city && (
                    <div className="flex items-start gap-3">
                      <svg className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">
                        Located in {listingData.hotel_city}
                      </span>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <svg className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-700">
                      Perfect for race weekend rest & recovery
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Bib details */}
            {(listingData.listing_type === "bib" || listingData.listing_type === "room_and_bib") && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-display text-lg font-semibold text-gray-900 mb-4">
                  Bib Transfer Details
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700 flex-shrink-0">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 mb-1">Available bibs</p>
                      <p className="font-semibold text-gray-900">
                        {listingData.bib_count || 1} bib{(listingData.bib_count || 1) > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  
                  {listingData.transfer_type && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-blue-900 mb-1">Transfer method</p>
                      <p className="text-sm text-blue-800">
                        {listingData.transfer_type === "official_process" && "✓ Official organizer name change process"}
                        {listingData.transfer_type === "package" && "✓ Included in complete race package"}
                        {listingData.transfer_type === "contact" && "Contact seller for transfer details"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            {listingData.description && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-display text-lg font-semibold text-gray-900 mb-3">
                  Additional Information
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {listingData.description}
                </p>
              </div>
            )}

            {/* How to Complete Transaction */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-display text-lg font-semibold text-gray-900 mb-4">
                How to Complete This Transaction
              </h3>

              {listingData.listing_type === "room" && (
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Follow these steps after agreeing with the seller:
                  </p>
                  <ol className="space-y-3">
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-semibold flex-shrink-0">1</span>
                      <div>
                        <p className="font-medium text-gray-900">Confirm booking details</p>
                        <p className="text-sm text-gray-600">Verify check-in/out dates, room type, and hotel name with the seller.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-semibold flex-shrink-0">2</span>
                      <div>
                        <p className="font-medium text-gray-900">Arrange name change</p>
                        <p className="text-sm text-gray-600">The seller will contact the hotel to transfer the reservation to your name. Some hotels may charge a fee.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-semibold flex-shrink-0">3</span>
                      <div>
                        <p className="font-medium text-gray-900">Get written confirmation</p>
                        <p className="text-sm text-gray-600">Request the updated booking confirmation directly from the hotel with your name.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-semibold flex-shrink-0">4</span>
                      <div>
                        <p className="font-medium text-gray-900">Complete payment</p>
                        <p className="text-sm text-gray-600">Pay the seller only after receiving the hotel confirmation. Use PayPal or bank transfer for safety.</p>
                      </div>
                    </li>
                  </ol>
                </div>
              )}

              {listingData.listing_type === "bib" && (
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Follow these steps after agreeing with the seller:
                  </p>
                  <ol className="space-y-3">
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-sm font-semibold flex-shrink-0">1</span>
                      <div>
                        <p className="font-medium text-gray-900">Check race transfer policy</p>
                        <p className="text-sm text-gray-600">Visit the official race website to verify if bib transfers are allowed and the deadline.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-sm font-semibold flex-shrink-0">2</span>
                      <div>
                        <p className="font-medium text-gray-900">Initiate official transfer</p>
                        <p className="text-sm text-gray-600">The seller must start the name change process through the race organizer's system. You may need to provide your details.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-sm font-semibold flex-shrink-0">3</span>
                      <div>
                        <p className="font-medium text-gray-900">Receive confirmation</p>
                        <p className="text-sm text-gray-600">Wait for official confirmation from the race organizer that the bib is now registered in your name.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-sm font-semibold flex-shrink-0">4</span>
                      <div>
                        <p className="font-medium text-gray-900">Complete payment</p>
                        <p className="text-sm text-gray-600">Pay the seller only after the transfer is confirmed. Use PayPal or bank transfer for safety.</p>
                      </div>
                    </li>
                  </ol>
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <span className="font-medium">Important:</span> Never run with someone else's bib without an official transfer. This violates race rules and insurance coverage.
                    </p>
                  </div>
                </div>
              )}

              {listingData.listing_type === "room_and_bib" && (
                <div className="space-y-4">
                  <p className="text-gray-600">
                    This is a complete package. Follow these steps after agreeing with the seller:
                  </p>
                  <ol className="space-y-3">
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-sm font-semibold flex-shrink-0">1</span>
                      <div>
                        <p className="font-medium text-gray-900">Verify package contents</p>
                        <p className="text-sm text-gray-600">Confirm exactly what's included: hotel dates, room type, race bib, and any extras.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-sm font-semibold flex-shrink-0">2</span>
                      <div>
                        <p className="font-medium text-gray-900">Start bib transfer first</p>
                        <p className="text-sm text-gray-600">The race bib transfer often has strict deadlines. The seller should initiate this through the official organizer.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-sm font-semibold flex-shrink-0">3</span>
                      <div>
                        <p className="font-medium text-gray-900">Transfer hotel booking</p>
                        <p className="text-sm text-gray-600">The seller contacts the hotel to change the reservation name. Request confirmation directly from the hotel.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-sm font-semibold flex-shrink-0">4</span>
                      <div>
                        <p className="font-medium text-gray-900">Get all confirmations</p>
                        <p className="text-sm text-gray-600">Collect written confirmation for both the race entry and hotel booking in your name.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-sm font-semibold flex-shrink-0">5</span>
                      <div>
                        <p className="font-medium text-gray-900">Complete payment</p>
                        <p className="text-sm text-gray-600">Pay only after receiving all confirmations. Use PayPal or bank transfer for safety.</p>
                      </div>
                    </li>
                  </ol>
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">Tip:</span> For packages, consider splitting the payment — partial after bib confirmation, remainder after hotel confirmation.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - sticky */}
          <div className="space-y-6 lg:sticky lg:top-6">
            {/* Main sidebar card: Badge + Event + Seller + Price */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              {/* 1. Badge e Save */}
              <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold border ${typeColors[listingData.listing_type as keyof typeof typeColors]}`}>
                  {typeLabels[listingData.listing_type as keyof typeof typeLabels]}
                </span>

                <div className="flex items-center gap-3">
                  {user && !isOwner && listingData.status === "active" && (
                    <saveFetcher.Form method="post" action="/api/saved">
                      <input type="hidden" name="listingId" value={listingData.id} />
                      <input type="hidden" name="action" value={isSavedOptimistic ? "unsave" : "save"} />
                      <button
                        type="submit"
                        className={`p-2 rounded-full transition-colors ${
                          isSavedOptimistic
                            ? "text-red-500 bg-red-50 hover:bg-red-100"
                            : "text-gray-400 bg-gray-100 hover:bg-gray-200 hover:text-gray-600"
                        }`}
                        title={isSavedOptimistic ? "Remove from saved" : "Save listing"}
                      >
                        <svg
                          className="h-5 w-5"
                          fill={isSavedOptimistic ? "currentColor" : "none"}
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                          />
                        </svg>
                      </button>
                    </saveFetcher.Form>
                  )}

                  {listingData.status !== "active" && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                      {listingData.status === "sold" ? "Sold" : "Expired"}
                    </span>
                  )}
                </div>
              </div>

              {/* 2. Event Context */}
              <div className="p-5 bg-gradient-to-br from-brand-50 to-blue-50">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 text-white flex-shrink-0">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="font-display text-lg font-bold text-gray-900">
                      {listingData.event.name}
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">Race day:</span> {eventDateFormatted}
                    </p>
                    {daysUntil > 0 && daysUntil <= 60 && (
                      <span className="inline-block mt-3 px-2.5 py-1 text-xs font-medium text-accent-600 bg-accent-50 border border-accent-300 rounded-full">
                        {daysUntil} days until race
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Seller */}
              <div className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold flex-shrink-0">
                    {listingData.author.company_name?.charAt(0) ||
                      listingData.author.full_name?.charAt(0) ||
                      "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-gray-900 truncate text-sm">
                        {listingData.author.company_name || listingData.author.full_name}
                      </p>
                      {listingData.author.is_verified && (
                        <svg className="h-4 w-4 text-brand-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {listingData.author.user_type === "tour_operator"
                        ? "Tour Operator"
                        : "Private Seller"}
                      {listingData.author.is_verified && " · Verified"}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Price */}
              <div className="p-5">
                <div className="text-center pb-4">
                  {/* Se è bib o room_and_bib, mostra associated costs */}
                  {(listingData.listing_type === "bib" || listingData.listing_type === "room_and_bib") ? (
                    listingData.associated_costs ? (
                      <>
                        <p className="text-sm text-gray-500 mb-1">Associated costs</p>
                        <p className="text-3xl font-bold text-gray-900">
                          €{listingData.associated_costs.toLocaleString()}
                        </p>
                        {listingData.cost_notes && (
                          <p className="mt-2 text-sm text-gray-600">
                            {listingData.cost_notes}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-xl font-semibold text-gray-600 mb-1">
                          Contact for price
                        </p>
                        <p className="text-xs text-gray-500">
                          Price details available from seller
                        </p>
                      </>
                    )
                  ) : listingData.price ? (
                    <>
                      <p className="text-3xl font-bold text-gray-900">
                        €{listingData.price.toLocaleString()}
                      </p>
                      {listingData.price_negotiable && (
                        <p className="mt-1 text-sm text-green-600 font-medium">
                          Price negotiable
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-xl font-semibold text-gray-600 mb-1">
                        Contact for price
                      </p>
                      <p className="text-xs text-gray-500">
                        {priceAnchor}
                      </p>
                    </>
                  )}
                </div>

                {(actionData as any)?.error && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 mb-4">
                    {(actionData as any).error}
                  </div>
                )}

                {listingData.status === "active" && !isOwner && (
                  <Form method="post">
                    <button type="submit" className="btn-primary w-full text-base py-3 font-semibold">
                      Request price & availability
                    </button>
                  </Form>
                )}

                {isOwner && (
                  <div className="space-y-3">
                    <Link
                      to={`/listings/${listingData.id}/edit`}
                      className="btn-secondary w-full"
                    >
                      Edit Listing
                    </Link>
                    <Form method="post" onSubmit={(e) => {
                      if (!confirm("Are you sure you want to delete this listing? This action cannot be undone.")) {
                        e.preventDefault();
                      }
                    }}>
                      <input type="hidden" name="_action" value="delete" />
                      <button
                        type="submit"
                        className="w-full px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:text-red-700 transition-colors"
                      >
                        Delete Listing
                      </button>
                    </Form>
                  </div>
                )}

                {!user && listingData.status === "active" && (
                  <Link
                    to={`/login?redirectTo=/listings/${listingData.id}`}
                    className="btn-primary w-full"
                  >
                    Login to Contact
                  </Link>
                )}
              </div>
            </div>

            {/* Safety tips - Accordion */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <button
                onClick={() => setShowSafety(!showSafety)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="font-medium text-gray-900">Safety & Payments</span>
                </div>
                <svg
                  className={`h-5 w-5 text-gray-400 transition-transform ${showSafety ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showSafety && (
                <div className="px-4 pb-4">
                  <ul className="text-sm text-gray-700 space-y-2 mt-3">
                    <li className="flex items-start gap-2">
                      <span className="text-brand-500 flex-shrink-0">•</span>
                      <span>Always verify seller identity before payment</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-brand-500 flex-shrink-0">•</span>
                      <span>Use secure payment methods (PayPal, bank transfer)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-brand-500 flex-shrink-0">•</span>
                      <span>Get written confirmation of all details</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-brand-500 flex-shrink-0">•</span>
                      <span>Report suspicious activity immediately</span>
                    </li>
                  </ul>
                  <Link
                    to="/safety"
                    className="mt-3 inline-block text-sm text-brand-600 hover:text-brand-700 font-medium"
                  >
                    Read full safety guidelines →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile sticky CTA - solo su mobile */}
        {listingData.status === "active" && !isOwner && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg lg:hidden z-10">
            <Form method="post">
              <button type="submit" className="btn-primary w-full text-base py-3 font-semibold">
                Request price & availability
              </button>
            </Form>
          </div>
        )}
      </main>
    </div>
  );
}
