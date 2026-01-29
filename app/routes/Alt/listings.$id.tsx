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
      event:events(id, name, location, country, event_date)
    `
    )
    .eq("id", id!)
    .single();

  if (error || !listing) {
    throw new Response("Listing not found", { status: 404 });
  }

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

  const { data: listing } = await supabaseAdmin
    .from("listings")
    .select("author_id")
    .eq("id", id!)
    .single<{ author_id: string }>();

  if (!listing) {
    return data({ error: "Listing not found" }, { status: 404 });
  }

  if (actionType === "delete") {
    if (listing.author_id !== userId) {
      return data({ error: "Unauthorized" }, { status: 403 });
    }

    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("user_type")
      .eq("id", userId)
      .single();

    const { error } = await supabaseAdmin
      .from("listings")
      .delete()
      .eq("id", id!);

    if (error) {
      return data({ error: "Failed to delete listing" }, { status: 500 });
    }

    const redirectPath = userProfile?.user_type === "tour_operator" ? "/dashboard" : "/my-listings";
    return redirect(redirectPath);
  }

  if (listing.author_id === userId) {
    return data({ error: "You cannot message yourself" }, { status: 400 });
  }

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
  room: "Room",
  bib: "Bib",
  room_and_bib: "Package",
};

const typeConfig = {
  room: {
    bg: "bg-emerald-500",
    bgLight: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  bib: {
    bg: "bg-orange-500",
    bgLight: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
  },
  room_and_bib: {
    bg: "bg-blue-500",
    bgLight: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
};

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

function getDaysUntilEvent(eventDate: string): number {
  const today = new Date();
  const event = new Date(eventDate);
  const diffTime = event.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

  const isOwner = userData?.id === listingData.author_id;
  const daysUntil = getDaysUntilEvent(listingData.event.event_date);
  const config = typeConfig[listingData.listing_type as keyof typeof typeConfig];

  const priceAnchor = listingData.hotel_stars
    ? `Comparable ${listingData.hotel_stars}-star hotels from €${Math.round((listingData.hotel_stars * 80) + 100)}`
    : "Comparable hotels from €200+";

  return (
    <div className="min-h-screen bg-stone-50">
      <Header user={user} />

      {/* Hero Header with Event Info */}
      <div className="relative bg-gradient-to-br from-stone-900 via-stone-800 to-emerald-900 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-6 py-8">
          {/* Back Link */}
          <Link
            to="/listings"
            className="inline-flex items-center gap-2 text-stone-400 hover:text-white transition-colors mb-6 group"
          >
            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Back to listings</span>
          </Link>

          {/* Event Info */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 rounded-2xl ${config.bg} flex items-center justify-center shadow-lg`}>
                <div className="text-white scale-150">
                  {config.icon}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${config.bgLight} ${config.text} border ${config.border}`}>
                    {config.icon}
                    {typeLabels[listingData.listing_type as keyof typeof typeLabels]}
                  </span>
                  {listingData.status !== "active" && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-stone-700 text-stone-300">
                      {listingData.status === "sold" ? "Sold" : "Expired"}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                  {listingData.event.name}
                </h1>
                <p className="text-stone-300">
                  {eventDateFormatted} · {listingData.event.location}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {user && !isOwner && listingData.status === "active" && (
                <saveFetcher.Form method="post" action="/api/saved">
                  <input type="hidden" name="listingId" value={listingData.id} />
                  <input type="hidden" name="action" value={isSavedOptimistic ? "unsave" : "save"} />
                  <button
                    type="submit"
                    className={`p-3 rounded-xl border-2 transition-all ${
                      isSavedOptimistic
                        ? "bg-red-500/20 border-red-400/50 text-red-400 hover:bg-red-500/30"
                        : "bg-white/5 border-white/20 text-white/70 hover:text-red-400 hover:border-red-400/50"
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

              {daysUntil > 0 && daysUntil <= 60 && (
                <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold text-sm shadow-lg">
                  {daysUntil} days until race
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="relative z-10 mx-auto max-w-6xl px-6 -mt-6 pb-20">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Details */}
          <div className="lg:col-span-2 space-y-6">

            {/* Hotel & Location Card */}
            {(listingData.listing_type === "room" || listingData.listing_type === "room_and_bib") && (
              <div className="bg-white rounded-2xl shadow-xl shadow-stone-200/50 border border-stone-100 overflow-hidden">
                <div className="p-6 border-b border-stone-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-bold text-stone-900">Hotel & Accommodation</h2>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Hotel Name */}
                  {listingData.hotel_name && (
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1">Hotel</p>
                        {listingData.hotel_website ? (
                          <a
                            href={listingData.hotel_website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-lg font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1.5 group"
                          >
                            {listingData.hotel_name}
                            <svg className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ) : (
                          <p className="text-lg font-semibold text-stone-900">{listingData.hotel_name}</p>
                        )}
                        {(listingData.hotel_city || listingData.hotel_country) && (
                          <p className="text-sm text-stone-500 mt-0.5">
                            {listingData.hotel_city}{listingData.hotel_city && listingData.hotel_country ? ", " : ""}{listingData.hotel_country}
                          </p>
                        )}
                        {listingData.hotel_rating && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <div className="flex items-center gap-0.5 px-2 py-1 bg-amber-50 rounded-lg">
                              <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              <span className="text-sm font-semibold text-amber-700">{listingData.hotel_rating.toFixed(1)}</span>
                            </div>
                            <span className="text-xs text-stone-400">Google Rating</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* Room Type */}
                    <div className="p-4 bg-stone-50 rounded-xl">
                      <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1">Room Type</p>
                      <p className="text-lg font-semibold text-stone-900">
                        {listingData.room_count || 1} × {formatRoomType(listingData.room_type)}
                      </p>
                    </div>

                    {/* Dates */}
                    {listingData.check_in && listingData.check_out && (
                      <div className="p-4 bg-stone-50 rounded-xl">
                        <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1">Stay Period</p>
                        <p className="text-lg font-semibold text-stone-900">
                          {new Date(listingData.check_in).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} → {new Date(listingData.check_out).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </p>
                        <p className="text-sm text-stone-500">
                          {Math.ceil((new Date(listingData.check_out).getTime() - new Date(listingData.check_in).getTime()) / (1000 * 60 * 60 * 24))} nights
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Why this stay */}
                  {listingData.hotel_name && (
                    <div className="pt-4 border-t border-stone-100">
                      <p className="text-sm font-semibold text-stone-700 mb-3">Why this stay</p>
                      <div className="space-y-2">
                        {listingData.hotel_rating && listingData.hotel_rating >= 4 && (
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className="text-sm text-stone-600">Top-rated hotel</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-sm text-stone-600">Perfect for race weekend</span>
                        </div>
                        {listingData.hotel_city === listingData.event.location && (
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className="text-sm text-stone-600">Central location near race route</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bib Details Card */}
            {(listingData.listing_type === "bib" || listingData.listing_type === "room_and_bib") && (
              <div className="bg-white rounded-2xl shadow-xl shadow-stone-200/50 border border-stone-100 overflow-hidden">
                <div className="p-6 border-b border-stone-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-bold text-stone-900">Bib Transfer</h2>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                      <span className="text-2xl font-bold text-white">{listingData.bib_count || 1}</span>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-stone-900">
                        {listingData.bib_count || 1} Bib{(listingData.bib_count || 1) > 1 ? "s" : ""} Available
                      </p>
                      <p className="text-sm text-stone-500">Race entry for {listingData.event.name}</p>
                    </div>
                  </div>

                  {listingData.transfer_type && (
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-blue-900">Transfer Method</p>
                          <p className="text-sm text-blue-700 mt-0.5">
                            {listingData.transfer_type === "official_process" && "Official organizer name change process"}
                            {listingData.transfer_type === "package" && "Included in complete race package"}
                            {listingData.transfer_type === "contact" && "Contact seller for transfer details"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            {listingData.description && (
              <div className="bg-white rounded-2xl shadow-xl shadow-stone-200/50 border border-stone-100 overflow-hidden">
                <div className="p-6 border-b border-stone-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-bold text-stone-900">Additional Information</h2>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-stone-700 whitespace-pre-wrap leading-relaxed">
                    {listingData.description}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Price Card */}
            <div className="bg-white rounded-2xl shadow-xl shadow-stone-200/50 border border-stone-100 overflow-hidden lg:sticky lg:top-6">
              <div className="p-6">
                {/* Price Display */}
                <div className="text-center pb-6 border-b border-stone-100">
                  {(listingData.listing_type === "bib" || listingData.listing_type === "room_and_bib") ? (
                    listingData.associated_costs ? (
                      <>
                        <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Associated Costs</p>
                        <p className="text-4xl font-bold text-stone-900">
                          €{listingData.associated_costs.toLocaleString()}
                        </p>
                        {listingData.cost_notes && (
                          <p className="mt-2 text-sm text-stone-500">{listingData.cost_notes}</p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-xl font-semibold text-stone-700 mb-1">Contact for price</p>
                        <p className="text-sm text-stone-400">Price details from seller</p>
                      </>
                    )
                  ) : listingData.price ? (
                    <>
                      <p className="text-4xl font-bold text-stone-900">
                        €{listingData.price.toLocaleString()}
                      </p>
                      {listingData.price_negotiable && (
                        <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-full">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          Negotiable
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-xl font-semibold text-stone-700 mb-1">Contact for price</p>
                      <p className="text-sm text-stone-400">{priceAnchor}</p>
                    </>
                  )}
                </div>

                {/* Error Message */}
                {(actionData as any)?.error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl">
                    <p className="text-sm text-red-700">{(actionData as any).error}</p>
                  </div>
                )}

                {/* Action Buttons */}
                {listingData.status === "active" && !isOwner && (
                  <Form method="post" className="mt-6">
                    <button
                      type="submit"
                      className="w-full group inline-flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Request price & availability
                    </button>
                  </Form>
                )}

                {isOwner && (
                  <div className="mt-6 space-y-3">
                    <Link
                      to={`/listings/${listingData.id}/edit`}
                      className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Listing
                    </Link>
                    <Form
                      method="post"
                      onSubmit={(e) => {
                        if (!confirm("Are you sure you want to delete this listing? This action cannot be undone.")) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="_action" value="delete" />
                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 font-semibold rounded-xl border border-red-200 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Listing
                      </button>
                    </Form>
                  </div>
                )}

                {!user && listingData.status === "active" && (
                  <div className="mt-6">
                    <Link
                      to={`/login?redirectTo=/listings/${listingData.id}`}
                      className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-emerald-500/25"
                    >
                      Login to Contact
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Seller Card */}
            <div className="bg-white rounded-2xl shadow-xl shadow-stone-200/50 border border-stone-100 overflow-hidden">
              <div className="p-6">
                <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">Seller</h3>
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-lg shadow-emerald-500/20">
                    {listingData.author.company_name?.charAt(0) ||
                      listingData.author.full_name?.charAt(0) ||
                      "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-stone-900 truncate">
                        {listingData.author.company_name || listingData.author.full_name}
                      </p>
                      {listingData.author.is_verified && (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-stone-500 mt-0.5">
                      {listingData.author.user_type === "tour_operator" ? "Tour Operator" : "Private Seller"}
                    </p>
                    {listingData.author.is_verified && (
                      <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
                        Verified seller
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Safety Tips */}
            <div className="bg-white rounded-2xl shadow-xl shadow-stone-200/50 border border-stone-100 overflow-hidden">
              <button
                onClick={() => setShowSafety(!showSafety)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <span className="font-semibold text-stone-900">Safety & Payments</span>
                </div>
                <svg
                  className={`w-5 h-5 text-stone-400 transition-transform ${showSafety ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showSafety && (
                <div className="px-4 pb-4 border-t border-stone-100">
                  <ul className="space-y-3 mt-4">
                    {[
                      "Always verify seller identity before payment",
                      "Use secure payment methods (PayPal, bank transfer)",
                      "Get written confirmation of all details",
                      "Report suspicious activity immediately",
                    ].map((tip, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-sm text-stone-600">{tip}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/safety"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    Read full safety guidelines
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Sticky CTA */}
        {listingData.status === "active" && !isOwner && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-lg border-t border-stone-200 shadow-lg lg:hidden z-10">
            <Form method="post">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Request price & availability
              </button>
            </Form>
          </div>
        )}
      </main>
    </div>
  );
}
