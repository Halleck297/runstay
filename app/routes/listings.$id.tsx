import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData, useLoaderData, useFetcher, useLocation } from "react-router";
import { useState } from "react";
import { useI18n } from "~/hooks/useI18n";
import { getUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { applyListingPublicIdFilter, getListingPublicId, getProfilePublicId } from "~/lib/publicIds";
import { localizeListing, resolveLocaleForRequest } from "~/lib/locale";
import { applyListingDisplayCurrency, getCurrencyForCountry } from "~/lib/currency";
import { Header } from "~/components/Header";
import { FooterLight } from "~/components/FooterLight";
import { isAdmin } from "~/lib/user-access";
import { getPublicDisplayName, getPublicInitial } from "~/lib/user-display";
import { calculateDistanceData } from "~/lib/distance.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [{ title: (data as any)?.listing?.title || "Listing - Runoot" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getUser(request);
  const locale = resolveLocaleForRequest(request, (user as any)?.preferred_language);
  const viewerCurrency = getCurrencyForCountry((user as any)?.country || null);
  const { id } = params;

  const listingQuery = supabaseAdmin
    .from("listings")
    .select(
      `
      *,
      author:profiles!listings_author_id_fkey(id, short_id, full_name, company_name, user_type, is_verified, email, avatar_url, public_profile_enabled),
      event:events(id, name, slug, country, event_date, card_image_url, finish_lat, finish_lng)
    `
    );
  const { data: listing, error } = await applyListingPublicIdFilter(listingQuery as any, id!).single();

  if (error || !listing) {
    throw new Response("Listing not found", { status: 404 });
  }

  // Explicit visibility rules (mirror marketplace policy in app logic):
  // - Active listing: visible
  // - Owner can always view own listing
  // - Otherwise not found
  const currentUserId = (user as any)?.id as string | undefined;
  const canView = listing.status === "active" || (currentUserId && listing.author_id === currentUserId);
  if (!canView) {
    throw new Response("Listing not found", { status: 404 });
  }

  // Backfill distance metrics for older listings when coordinates are available.
  if (
    (listing.distance_to_finish == null || listing.walking_duration == null) &&
    listing.hotel_lat != null &&
    listing.hotel_lng != null &&
    listing.event?.finish_lat != null &&
    listing.event?.finish_lng != null
  ) {
    const refreshedDistance = await calculateDistanceData(
      listing.hotel_lat,
      listing.hotel_lng,
      listing.event.finish_lat,
      listing.event.finish_lng,
      listing.event?.event_date || undefined,
    );

    listing.distance_to_finish = refreshedDistance.distance_to_finish;
    listing.walking_duration = refreshedDistance.walking_duration;
    listing.transit_duration = refreshedDistance.transit_duration;

    await (supabaseAdmin.from("listings") as any)
      .update({
        distance_to_finish: refreshedDistance.distance_to_finish,
        walking_duration: refreshedDistance.walking_duration,
        transit_duration: refreshedDistance.transit_duration,
      })
      .eq("id", listing.id);
  }

  // Check if user has saved this listing
  let isSaved = false;
  if (user) {
    const userId = (user as any).id as string;
    const { data: savedListing } = await (supabaseAdmin as any)
      .from("saved_listings")
      .select("id")
      .eq("user_id", userId)
      .eq("listing_id", listing.id)
      .single();
    
    isSaved = !!savedListing;
  }

  const listingPublicId = getListingPublicId(listing as any);
  const { data: linkedEventRequest } = await (supabaseAdmin as any)
    .from("event_requests")
    .select(
      "id, team_leader_id, team_leader:profiles!event_requests_team_leader_id_fkey(id, short_id, full_name, company_name, user_type, is_verified, avatar_url, public_profile_enabled)"
    )
    .ilike("published_listing_url", `%/listings/${listingPublicId}`)
    .limit(1)
    .maybeSingle();

  const sellerId = (linkedEventRequest?.team_leader as any)?.id || (listing as any)?.author?.id;
  let sellerAccessMode: "internal_only" | "external_password" | "external_invite" | null = null;
  if (sellerId) {
    const { data: managedRow } = await (supabaseAdmin as any)
      .from("admin_managed_accounts")
      .select("access_mode")
      .eq("user_id", sellerId)
      .maybeSingle();
    sellerAccessMode = (managedRow?.access_mode as any) || null;
  }

  return {
    user,
    listing: applyListingDisplayCurrency(localizeListing(listing as any, locale), viewerCurrency),
    isSaved,
    isEventListing: !!linkedEventRequest,
    eventOrganizer: linkedEventRequest?.team_leader || null,
    sellerAccessMode,
  };
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
  const listingQuery = supabaseAdmin
    .from("listings")
    .select("id, author_id");
  const { data: listing } = await applyListingPublicIdFilter(listingQuery as any, id!).single();

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
      .eq("id", listing.id);

    if (error) {
      return data({ error: "Failed to delete listing" }, { status: 500 });
    }

    // Redirect based on user type
    const redirectPath = userProfile?.user_type === "tour_operator" ? "/to-panel" : "/my-listings";
    return redirect(redirectPath);
  }

  // No other actions - contact flow now handled by /listings/:id/contact
  return data({ error: "Invalid action" }, { status: 400 });
}

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

function formatCurrencyAmount(value: number | null | undefined, currency = "EUR"): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

type ToListingMeta = {
  room_types?: string[];
  room_type_prices?: Record<string, number>;
  room_type_prices_converted?: Record<string, Record<string, number>>;
  flexible_dates?: boolean;
  extra_night?: {
    enabled?: boolean;
    price?: number | null;
    prices_converted?: Record<string, number> | null;
    price_unit?: "per_person" | "per_room";
  };
  price_unit?: "by_room_type" | "per_person";
};

function parseCostNotes(raw: unknown): { note: string | null; toMeta: ToListingMeta | null } {
  if (typeof raw !== "string" || !raw.trim()) {
    return { note: null, toMeta: null };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as { note?: unknown; to_meta?: unknown };
      const note = typeof obj.note === "string" ? obj.note : null;
      const toMeta =
        obj.to_meta && typeof obj.to_meta === "object" && !Array.isArray(obj.to_meta)
          ? (obj.to_meta as ToListingMeta)
          : null;
      return { note, toMeta };
    }
  } catch {
    // Legacy plain-text cost notes.
  }
  return { note: raw, toMeta: null };
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
  const { t } = useI18n();
  const location = useLocation();
  const { user, listing, isSaved, isEventListing, eventOrganizer, sellerAccessMode } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [showHowTo, setShowHowTo] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const saveFetcher = useFetcher();
  const isSavedOptimistic = saveFetcher.formData
    ? saveFetcher.formData.get("action") === "save"
    : isSaved;
  
  const listingData = listing as any;
  const userData = user as any;
  const bibLabel = t("common.bib");
  const bibsLabel = t("common.bibs");
  const parsedCostNotes = parseCostNotes(listingData.cost_notes);
  const toMeta = parsedCostNotes.toMeta;
  const roomTypes = Array.isArray(toMeta?.room_types) ? toMeta?.room_types || [] : [];
  const roomTypePrices =
    (toMeta?.room_type_prices_converted &&
      listingData.currency &&
      toMeta.room_type_prices_converted[String(listingData.currency).toUpperCase()]) ||
    toMeta?.room_type_prices ||
    {};
  const hasToRoomTypePrices = roomTypes.some((type) => typeof roomTypePrices[type] === "number");
  const isFlexibleDates = !!toMeta?.flexible_dates;
  const hasExtraNight = !!toMeta?.extra_night?.enabled;
  const extraNightDisplayAmount =
    (toMeta?.extra_night?.prices_converted &&
      listingData.currency &&
      toMeta.extra_night.prices_converted[String(listingData.currency).toUpperCase()]) ||
    toMeta?.extra_night?.price;
  const extraNightPriceLabel =
    hasExtraNight && typeof extraNightDisplayAmount === "number"
      ? `${formatCurrencyAmount(extraNightDisplayAmount, listingData.currency || "EUR")} ${
          toMeta?.extra_night?.price_unit === "per_room" ? "per room" : "per person"
        }`
      : null;
  
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
  const isAdminViewer = isAdmin(userData);
  const sellerProfile = (isEventListing ? eventOrganizer : listingData.author) as any;
  const sellerIsInternalOnly = sellerAccessMode === "internal_only";
  const sellerIsAlwaysPublicRole =
    sellerProfile?.user_type === "tour_operator" || sellerProfile?.user_type === "team_leader";
  const sellerIsProfileVisible =
    !!sellerProfile &&
    !sellerIsInternalOnly &&
    (
      sellerIsAlwaysPublicRole ||
      sellerProfile.public_profile_enabled === true ||
      userData?.id === sellerProfile.id ||
      isAdminViewer
    );
  const canOpenSellerProfile = !!sellerProfile?.id && sellerIsProfileVisible;
  const sellerPublicId = sellerProfile ? getProfilePublicId(sellerProfile) : null;
  const daysUntil = getDaysUntilEvent(listingData.event.event_date);
  const eventSlug = getEventSlug(listingData.event);
  const bannerFallback = `/banners/${eventSlug}.jpg`;
  const eventsFallback = `/events/${eventSlug}.jpg`;
  const bannerPrimary = listingData.event.card_image_url || bannerFallback;
  const profileBackState = { from: `${location.pathname}${location.search}` };

  // Genera sottotitolo contestuale
  let subtitle = "";
  if (listingData.listing_type === "room") {
    const nights = listingData.check_in && listingData.check_out 
      ? Math.ceil((new Date(listingData.check_out).getTime() - new Date(listingData.check_in).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    subtitle = `${formatRoomType(listingData.room_type)} · ${nights > 0 ? `${nights} nights` : "Race weekend"}`;
  } else if (listingData.listing_type === "bib") {
    subtitle = `${listingData.bib_count || 1} ${(listingData.bib_count || 1) > 1 ? bibsLabel : bibLabel} available`;
  } else {
    subtitle = "Complete race weekend package";
  }

  // Price anchor (stima comparativa)
  const priceAnchor = listingData.hotel_stars 
    ? `Comparable ${listingData.hotel_stars}-star hotels from €${Math.round((listingData.hotel_stars * 80) + 100)}`
    : "Comparable hotels from €200+";

  return (
    <div className="min-h-screen bg-[#ECF4FE]">
      <div className="min-h-screen flex flex-col">
        <Header user={user} />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-12 md:pb-6 sm:px-6 lg:px-8">
          {/* Back link */}
          <div className="mb-4">
            <Link
              to={isEventListing ? "/events" : "/listings"}
              className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/95 px-4 py-2 text-sm font-semibold text-gray-800 shadow-[0_8px_22px_rgba(15,23,42,0.16)] ring-1 ring-slate-200/80 backdrop-blur-sm transition hover:bg-white hover:shadow-[0_10px_26px_rgba(15,23,42,0.20)]"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t("listings.back_to_listings")}
            </Link>
          </div>

          {/* Event Image Banner */}
          <div className="rounded-3xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.15)] mb-6">
            <img
              src={bannerPrimary}
              alt={listingData.event.name}
              className="w-full h-[375px] sm:h-[480px] md:h-[570px] object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                const bannerAbsolute = new URL(bannerFallback, window.location.origin).href;
                const eventsAbsolute = new URL(eventsFallback, window.location.origin).href;
                if (target.src !== bannerAbsolute && !target.dataset.triedBannerFallback) {
                  target.dataset.triedBannerFallback = "true";
                  target.src = bannerFallback;
                  return;
                }
                if (target.src !== eventsAbsolute && !target.dataset.triedEventsFallback) {
                  target.dataset.triedEventsFallback = "true";
                  target.src = eventsFallback;
                  return;
                }
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="w-full h-[375px] sm:h-[480px] md:h-[570px] bg-gradient-to-br from-brand-100 to-brand-200 items-center justify-center" style={{ display: 'none' }}>
              <svg className="h-16 w-16 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content - 2 colonne */}
          <div className="lg:col-span-2 space-y-6">

            {/* Details - Hotel & Location */}
            {(listingData.listing_type === "room" || listingData.listing_type === "room_and_bib") && (
              <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.15)] p-6">
                <h3 className="font-display text-lg font-semibold text-gray-900 pb-3 mb-6 border-b border-gray-200">
                  {t("listings.hotel_location")}
                </h3>

                <div className="space-y-5">
                  {/* Hotel info block */}
                  {listingData.hotel_name && (
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 flex-shrink-0">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div className="flex-1">
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
                            {listingData.hotel_rating && (
                              <span className="text-sm text-gray-500 font-normal ml-2">
                                ⭐ {listingData.hotel_rating.toFixed(1)}
                              </span>
                            )}
                          </p>
                          {(listingData.hotel_city || listingData.hotel_country) && (
                            <p className="text-sm text-gray-600 mt-0.5">
                              📍 {listingData.hotel_city || ""}{listingData.hotel_city && listingData.hotel_country ? ", " : ""}{listingData.hotel_country || ""}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Room details */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 flex-shrink-0">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19h16M4 15h16M4 15V9a2 2 0 012-2h2a2 2 0 012 2v0M4 15V9m8-2h6a2 2 0 012 2v6M4 9h4m0 0a2 2 0 012 2v4" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {listingData.room_count || 1} {formatRoomType(listingData.room_type)} room{(listingData.room_count || 1) > 1 ? "s" : ""}
                      </p>
                      {roomTypes.length > 0 && (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {roomTypes.map((type) => (
                            <span
                              key={type}
                              className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                            >
                              {formatRoomType(type)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {hasToRoomTypePrices && (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Room type pricing</p>
                      <div className="space-y-1.5">
                        {roomTypes.map((type) => (
                          typeof roomTypePrices[type] === "number" ? (
                            <div key={type} className="flex items-center justify-between text-sm">
                              <span className="text-slate-700">{formatRoomType(type)}</span>
                              <span className="font-semibold text-slate-900">
                                {formatCurrencyAmount(roomTypePrices[type], listingData.currency || "EUR")}
                              </span>
                            </div>
                          ) : null
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Check-in/out */}
                  {listingData.check_in && listingData.check_out && (() => {
                    const checkIn = new Date(listingData.check_in);
                    const checkOut = new Date(listingData.check_out);
                    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 flex-shrink-0">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            {checkIn.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} → {checkOut.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            <span className="text-sm text-gray-500 font-normal ml-2">
                              ({nights} night{nights > 1 ? "s" : ""})
                            </span>
                          </p>
                          {isFlexibleDates && (
                            <p className="mt-1 text-xs font-medium text-amber-700">
                              Flexible dates available on request
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {hasExtraNight && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 flex-shrink-0">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">Extra night available</p>
                        {extraNightPriceLabel && <p className="text-sm text-gray-600">{extraNightPriceLabel}</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Distance to Finish Line - Separate container */}
            {(listingData.distance_to_finish !== null ||
              listingData.walking_duration !== null ||
              listingData.transit_duration !== null) && (
              <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.15)] p-6">
                <h3 className="font-display text-lg font-semibold text-gray-900 mb-4">
                  Distance to Finish Line
                </h3>
                <div className="space-y-3">
                  {/* Distance */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700 flex-shrink-0">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {listingData.distance_to_finish == null
                          ? "-"
                          : listingData.distance_to_finish < 1000
                            ? `${listingData.distance_to_finish}m`
                            : `${(listingData.distance_to_finish / 1000).toFixed(1)}km`}
                      </p>
                      <p className="text-sm text-gray-500">Straight-line distance</p>
                    </div>
                  </div>

                  {/* Walking duration */}
                  {listingData.walking_duration !== null && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700 flex-shrink-0">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="4.5" r="2.5"/>
                          <path d="M10.5 8.5L7 11l1.5 1.5 2.5-2v4l-3 5.5 1.5 1 3-5 3 5 1.5-1-3-5.5v-4l2.5 2L17 11l-3.5-2.5h-3z"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{listingData.walking_duration} min</p>
                        <p className="text-sm text-gray-500">Walking</p>
                      </div>
                    </div>
                  )}

                  {/* Transit duration - only show if > 1km */}
                  {listingData.transit_duration !== null &&
                    (listingData.distance_to_finish == null || listingData.distance_to_finish > 1000) && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700 flex-shrink-0">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v10M16 7v10M6 17h12M6 7h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2z" />
                          <circle cx="8" cy="19" r="1.5" fill="currentColor" />
                          <circle cx="16" cy="19" r="1.5" fill="currentColor" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{listingData.transit_duration} min</p>
                        <p className="text-sm text-gray-500">Public transit</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bib details */}
            {(listingData.listing_type === "bib" || listingData.listing_type === "room_and_bib") && (
              <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.15)] p-6">
                <h3 className="font-display text-lg font-semibold text-gray-900 mb-4">
                  {bibLabel} Transfer Details
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700 flex-shrink-0">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 mb-1">Available {bibsLabel.toLowerCase()}</p>
                      <p className="font-semibold text-gray-900">
                        {listingData.bib_count || 1} {(listingData.bib_count || 1) > 1 ? bibsLabel : bibLabel}
                      </p>
                    </div>
                  </div>
                  
                  {listingData.transfer_type && (
                    <div className="bg-blue-50 border border-blue-200 rounded-3xl p-4">
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
              <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.15)] p-6">
                <h3 className="font-display text-lg font-semibold text-gray-900 mb-3">
                  Additional Information
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {listingData.description}
                </p>
              </div>
            )}

            {/* How to Complete Transaction */}
            {isEventListing ? (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.10)]">
                <button
                  onClick={() => setShowHowTo(!showHowTo)}
                  className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-gray-50 lg:cursor-default lg:hover:bg-white"
                >
                  <span className="font-display text-lg font-semibold text-gray-900">How to Proceed</span>
                  <svg
                    className={`h-5 w-5 text-gray-400 transition-transform lg:hidden ${showHowTo ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className={`${showHowTo ? "block" : "hidden"} px-4 pb-4 lg:block`}>
                  <ol className="space-y-3">
                    <li className="flex gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 text-base font-semibold flex-shrink-0">1</span>
                      <div>
                        <p className="font-medium text-gray-900">Confirm package details</p>
                        <p className="text-sm text-gray-600">Review inclusions, dates, and participant details with the organizer.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 text-base font-semibold flex-shrink-0">2</span>
                      <div>
                        <p className="font-medium text-gray-900">Share required participant info</p>
                        <p className="text-sm text-gray-600">Provide runner data needed for registrations, rooming, and logistics.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 text-base font-semibold flex-shrink-0">3</span>
                      <div>
                        <p className="font-medium text-gray-900">Receive final confirmation</p>
                        <p className="text-sm text-gray-600">The organizer will confirm your slot and send operational details.</p>
                      </div>
                    </li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.10)]">
                <button
                  onClick={() => setShowHowTo(!showHowTo)}
                  className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-gray-50 lg:cursor-default lg:hover:bg-white"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <svg className="h-5 w-5 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
                    </svg>
                    <span className="font-display text-sm font-semibold text-gray-900 sm:text-base lg:text-lg whitespace-nowrap">How to Complete Transaction</span>
                  </span>
                  <svg
                    className={`h-5 w-5 text-gray-400 transition-transform lg:hidden ${showHowTo ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div className={`${showHowTo ? "block" : "hidden"} px-4 pb-4 lg:block`}>
                  {listingData.listing_type === "room" && (
                    <div className="space-y-4">
                      <p className="text-gray-600">
                        Follow these steps after agreeing with the seller:
                      </p>
                      <ol className="space-y-3">
                        <li className="flex gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 text-base font-semibold flex-shrink-0">1</span>
                          <div>
                            <p className="font-medium text-gray-900">Confirm booking details</p>
                            <p className="text-sm text-gray-600">Verify check-in/out dates, room type, and hotel name with the seller.</p>
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 text-base font-semibold flex-shrink-0">2</span>
                          <div>
                            <p className="font-medium text-gray-900">Arrange name change</p>
                            <p className="text-sm text-gray-600">The seller will contact the hotel to transfer the reservation to your name. Some hotels may charge a fee.</p>
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 text-base font-semibold flex-shrink-0">3</span>
                          <div>
                            <p className="font-medium text-gray-900">Get written confirmation</p>
                            <p className="text-sm text-gray-600">Request the updated booking confirmation directly from the hotel with your name.</p>
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 text-base font-semibold flex-shrink-0">4</span>
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
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 text-base font-semibold flex-shrink-0">1</span>
                        <div>
                          <p className="font-medium text-gray-900">Check race transfer policy</p>
                          <p className="text-sm text-gray-600">Visit the official race website to verify if {bibsLabel.toLowerCase()} transfers are allowed and the deadline.</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 text-base font-semibold flex-shrink-0">2</span>
                        <div>
                          <p className="font-medium text-gray-900">Initiate official transfer</p>
                          <p className="text-sm text-gray-600">The seller must start the name change process through the race organizer's system. You may need to provide your details.</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 text-base font-semibold flex-shrink-0">3</span>
                        <div>
                          <p className="font-medium text-gray-900">Receive confirmation</p>
                          <p className="text-sm text-gray-600">Wait for official confirmation from the race organizer that the {bibLabel.toLowerCase()} is now registered in your name.</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 text-base font-semibold flex-shrink-0">4</span>
                        <div>
                          <p className="font-medium text-gray-900">Complete payment</p>
                          <p className="text-sm text-gray-600">Pay the seller only after the transfer is confirmed. Use PayPal or bank transfer for safety.</p>
                        </div>
                      </li>
                    </ol>
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-3xl">
                      <p className="text-sm text-amber-800">
                        <span className="font-medium">Important:</span> Never run with someone else's {bibLabel.toLowerCase()} without an official transfer. This violates race rules and insurance coverage.
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
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 text-base font-semibold flex-shrink-0">1</span>
                        <div>
                          <p className="font-medium text-gray-900">Verify package contents</p>
                          <p className="text-sm text-gray-600">Confirm exactly what's included: hotel dates, room type, race {bibLabel.toLowerCase()}, and any extras.</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 text-base font-semibold flex-shrink-0">2</span>
                        <div>
                          <p className="font-medium text-gray-900">Start {bibLabel.toLowerCase()} transfer first</p>
                          <p className="text-sm text-gray-600">The race {bibLabel.toLowerCase()} transfer often has strict deadlines. The seller should initiate this through the official organizer.</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 text-base font-semibold flex-shrink-0">3</span>
                        <div>
                          <p className="font-medium text-gray-900">Transfer hotel booking</p>
                          <p className="text-sm text-gray-600">The seller contacts the hotel to change the reservation name. Request confirmation directly from the hotel.</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 text-base font-semibold flex-shrink-0">4</span>
                        <div>
                          <p className="font-medium text-gray-900">Get all confirmations</p>
                          <p className="text-sm text-gray-600">Collect written confirmation for both the race entry and hotel booking in your name.</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECF4FE] text-brand-500 text-base font-semibold flex-shrink-0">5</span>
                        <div>
                          <p className="font-medium text-gray-900">Complete payment</p>
                          <p className="text-sm text-gray-600">Pay only after receiving all confirmations. Use PayPal or bank transfer for safety.</p>
                        </div>
                      </li>
                    </ol>
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-3xl">
                      <p className="text-sm text-blue-800">
                        <span className="font-medium">Tip:</span> For packages, consider splitting the payment — partial after {bibLabel.toLowerCase()} confirmation, remainder after hotel confirmation.
                      </p>
                    </div>
                  </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - sticky */}
          <div className="space-y-6 lg:sticky lg:top-6">
            {/* Main sidebar card: Seller + Price + CTA */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.12)] overflow-hidden">
              {/* Listing Info Header */}
              <div className="px-6 py-5 border-b border-slate-200">
                {/* Badge tipo + Save */}
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-full bg-brand-500 text-white text-xs font-semibold uppercase tracking-wide">
                    {listingData.listing_type === "room"
                      ? "Room Only"
                      : listingData.listing_type === "bib"
                      ? t("edit_listing.bib_only")
                      : t("edit_listing.room_plus_bib")}
                  </span>

                  {user && !isOwner && listingData.status === "active" && (
                    <saveFetcher.Form method="post" action="/api/saved">
                      <input type="hidden" name="listingId" value={listingData.id} />
                      <input type="hidden" name="action" value={isSavedOptimistic ? "unsave" : "save"} />
                      <button
                        type="submit"
                        className={`rounded-full p-2.5 ring-1 ring-slate-200 shadow-sm transition-colors ${
                          isSavedOptimistic
                            ? "bg-red-50 text-red-500 hover:bg-red-100"
                            : "bg-slate-50 text-slate-700 ring-slate-300 hover:bg-slate-200 hover:text-red-500"
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
                </div>

                {/* Titolo - mostra solo il nome evento */}
                <h1 className="font-display text-xl font-bold text-gray-900 leading-tight">
                  {listingData.event.name}
                </h1>

                {/* Status */}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-900">
                    <svg className="h-4 w-4 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{eventDateShort}</span>
                  </div>
                  {listingData.status === "active" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                      <span className="h-2 w-2 rounded-full bg-green-500"></span>
                      Active
                    </span>
                  ) : listingData.status === "sold" || listingData.status === "expired" ? (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                      {listingData.status === "sold" ? "Sold" : "Expired"}
                    </span>
                  ) : !isOwner ? (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                      Listing unavailable
                    </span>
                  ) : null}
                </div>

                {listingData.status === "pending" && isOwner && (
                  <div className="mt-3 rounded-3xl border border-yellow-200 bg-yellow-50 px-4 py-3">
                    <p className="text-sm font-semibold text-yellow-800">Pending review</p>
                    <p className="mt-0.5 text-xs text-yellow-700">
                      Your listing is being reviewed by our team. We'll notify you once it's approved.
                    </p>
                  </div>
                )}

                {listingData.status === "rejected" && isOwner && (
                  <div className="mt-3 rounded-3xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm font-semibold text-red-800">Listing not approved</p>
                    {(listingData as any).admin_note && (
                      <p className="mt-0.5 text-xs text-red-700">{(listingData as any).admin_note}</p>
                    )}
                    <p className="mt-1 text-xs text-red-600">
                      Please contact us if you have questions.
                    </p>
                  </div>
                )}

                {listingData.status === "rejected" && !isOwner && (
                  <div className="mt-3">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                      Listing unavailable
                    </span>
                  </div>
                )}

                {listingData.status === "pending" && !isOwner && (
                  <div className="mt-3">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                      Listing unavailable
                    </span>
                  </div>
                )}
              </div>

              {/* Seller */}
              <div className="px-6 py-5 border-b border-slate-200">
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-brand-700 text-base font-semibold flex-shrink-0">
                      {(isEventListing ? eventOrganizer?.avatar_url : listingData.author.avatar_url) ? (
                        <img
                          src={(isEventListing ? eventOrganizer?.avatar_url : listingData.author.avatar_url) as string}
                          alt={
                            (isEventListing
                              ? getPublicDisplayName(eventOrganizer)
                              : getPublicDisplayName(listingData.author)) || "User avatar"
                          }
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        getPublicInitial(isEventListing ? eventOrganizer : listingData.author)
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-col gap-1 text-left">
                        <div className="flex items-center gap-1.5">
                        {canOpenSellerProfile && sellerPublicId ? (
                          <Link
                            to={`/profiles/${sellerPublicId}`}
                            state={profileBackState}
                            className="truncate text-lg font-semibold text-gray-900 hover:text-brand-700 hover:underline"
                          >
                            {getPublicDisplayName(sellerProfile)}
                          </Link>
                        ) : (
                          <p className="truncate text-lg font-semibold text-gray-900">
                            {getPublicDisplayName(sellerProfile)}
                          </p>
                        )}
                        {(isEventListing ? eventOrganizer?.is_verified : listingData.author.is_verified) && (
                          <svg className="h-5 w-5 text-brand-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                        </div>
                        <p className="text-sm text-gray-600">
                        {isEventListing
                          ? t("listings.team_leader_organizer")
                          : listingData.author.user_type === "tour_operator"
                          ? "Tour Operator"
                          : "Runner"}
                        {(isEventListing ? eventOrganizer?.is_verified : listingData.author.is_verified) && " · Verified"}
                      </p>
                      </div>
                    </div>
                  </div>
                  {canOpenSellerProfile && sellerPublicId && (
                    <Link
                      to={`/profiles/${sellerPublicId}`}
                      state={profileBackState}
                      className="mt-6 inline-flex w-fit rounded-full bg-[#ECF4FE] px-3.5 py-1 text-xs font-semibold uppercase tracking-wide text-brand-500 transition-colors hover:bg-brand-100 whitespace-nowrap"
                    >
                      {t("listings.view_profile")}
                    </Link>
                  )}
                </div>
              </div>

              {/* Price + CTA section */}
              <div className="border-t border-slate-200 bg-slate-50 p-6">
                <div className="text-center">
                  <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-900">
                    {(listingData.listing_type === "bib" || listingData.listing_type === "room_and_bib") && !isEventListing
                      ? "Associated costs"
                      : "Price"}
                  </p>
                  {/* For event listings, prioritize explicit listing price across all types */}
                  {isEventListing && listingData.price ? (
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
                  ) : (listingData.listing_type === "bib" || listingData.listing_type === "room_and_bib") ? (
                    listingData.associated_costs ? (
                      <>
                        <p className="text-3xl font-bold text-gray-900">
                          €{listingData.associated_costs.toLocaleString()}
                        </p>
                        {listingData.cost_notes && (
                          <p className="mt-2 text-sm text-gray-600">
                            {parsedCostNotes.note || ""}
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-lg font-semibold text-gray-700 mb-0.5">
                          Contact for price
                        </p>
                        <p className="text-xs text-gray-500">
                          Price details available from seller
                        </p>
                      </div>
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
                    <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-lg font-semibold text-gray-700 mb-0.5">
                        Contact for price
                      </p>
                      <p className="text-xs text-gray-500">
                        {priceAnchor}
                      </p>
                    </div>
                  )}
                </div>

                {(actionData as any)?.error && (
                  <div className="mb-4 rounded-3xl bg-red-50 p-3 text-sm text-red-700">
                    {(actionData as any).error}
                  </div>
                )}

                {listingData.status === "active" && !isOwner && !!user && (
                  <Link
      to={`/listings/${getListingPublicId(listingData)}/contact`}
                    className="mt-4 block w-full rounded-full bg-accent-500 px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent-600"
                  >
                    {t("listings.contact")} {getPublicDisplayName(listingData.author) || "Seller"}
                  </Link>
                )}

                {isOwner && (
                  <div className="mt-4 space-y-3">
                    <Link
                      to={`/listings/${getListingPublicId(listingData)}/edit`}
                      className="block w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      {t("listings.edit_listing")}
                    </Link>
                    <Form method="post" onSubmit={(e) => {
                      if (!confirm("Are you sure you want to delete this listing? This action cannot be undone.")) {
                        e.preventDefault();
                      }
                    }}>
                      <input type="hidden" name="_action" value="delete" />
                      <button
                        type="submit"
                        className="w-full rounded-full border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
                      >
                      {t("listings.delete_listing")}
                      </button>
                    </Form>
                  </div>
                )}

                {isEventListing && isAdminViewer && (
                  <div className="mt-3">
                    <Link
                      to={`/admin/events/new?listingId=${getListingPublicId(listingData)}`}
                      className="block w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      Edit Event Listing
                    </Link>
                  </div>
                )}

                {!user && listingData.status === "active" && (
                  <Link
                    to={`/login?redirectTo=/listings/${getListingPublicId(listingData)}`}
                    className="mt-4 block w-full rounded-full bg-accent-500 px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent-600"
                  >
                    {t("listings.login_to_contact")}
                  </Link>
                )}
              </div>
            </div>

            {!isEventListing && (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.10)]">
                <button
                  onClick={() => setShowSafety(!showSafety)}
                  className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-gray-50 lg:cursor-default lg:hover:bg-white"
                >
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="font-medium text-gray-900">Safety & Payments</span>
                  </div>
                  <svg
                    className={`h-5 w-5 text-gray-400 transition-transform lg:hidden ${showSafety ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div className={`${showSafety ? "block" : "hidden"} px-4 pb-4 lg:block`}>
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
              </div>
            )}
          </div>
        </div>

        </main>

        <FooterLight />
      </div>
    </div>
  );
}
