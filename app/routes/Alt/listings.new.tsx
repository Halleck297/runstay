import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { useState, useEffect } from "react";
import { requireUser } from "~/lib/session.server";
import { supabase, supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";
import { EventPicker } from "~/components/EventPicker";
import { HotelAutocomplete } from "~/components/HotelAutocomplete";
import {
  getMaxLimit,
  getTransferMethodOptions,
  getVisibleFieldsForTransferMethod,
  validateListingLimits
} from "~/config/listing-rules";
import type { TransferMethod } from "~/config/listing-rules";

export const meta: MetaFunction = () => {
  return [{ title: "Create Listing - Runoot Exchange" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: true });

  return {
    user,
    events: events || [],
    googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || ""
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();

  const listingType = formData.get("listingType") as string;
  const description = formData.get("description") as string;

  // Event fields
  const eventId = formData.get("eventId") as string;
  const newEventName = formData.get("newEventName") as string;
  const newEventLocation = formData.get("newEventLocation") as string;
  const newEventCountry = formData.get("newEventCountry") as string;
  const newEventDate = formData.get("newEventDate") as string;

  // Hotel fields from HotelAutocomplete component
  const hotelPlaceId = formData.get("hotelPlaceId") as string;
  const hotelName = formData.get("hotelName") as string;
  const hotelWebsite = formData.get("hotelWebsite") as string;
  const hotelCity = formData.get("hotelCity") as string;
  const hotelCountry = formData.get("hotelCountry") as string;
  const hotelLat = formData.get("hotelLat") as string;
  const hotelLng = formData.get("hotelLng") as string;
  const hotelRating = formData.get("hotelRating") as string;

  // Room fields
  const roomCount = formData.get("roomCount") as string;
  const roomType = formData.get("roomType") as string;
  const checkIn = formData.get("checkIn") as string;
  const checkOut = formData.get("checkOut") as string;

  // Bib fields
  const bibCount = formData.get("bibCount") as string;
  const transferType = formData.get("transferType") as string;
  const associatedCosts = formData.get("associatedCosts") as string;
  const costNotes = formData.get("costNotes") as string;

  // Price
  const price = formData.get("price") as string;
  const priceNegotiable = formData.get("priceNegotiable") === "on";

  // Validation
  if (!listingType) {
    return data({ error: "Please select a listing type" }, { status: 400 });
  }

  // Validate user type limits
  const validation = validateListingLimits(
    user.user_type,
    roomCount ? parseInt(roomCount) : null,
    bibCount ? parseInt(bibCount) : null,
    transferType
  );

  if (!validation.valid) {
    return data({ error: validation.error }, { status: 400 });
  }

  // Handle event - use existing or create new
  let finalEventId = eventId;

  if (!eventId && newEventName && newEventDate) {
    const { data: newEvent, error: eventError } = await supabase
      .from("events")
      .insert({
        name: newEventName,
        location: newEventLocation || "",
        country: newEventCountry || "",
        event_date: newEventDate,
        created_by: user.id,
      } as any)
      .select()
      .single<{ id: string }>();

    if (eventError) {
      return data({ error: "Failed to create event" }, { status: 400 });
    }

    finalEventId = newEvent.id;
  }

  if (!finalEventId) {
    return data({ error: "Please select or create an event" }, { status: 400 });
  }

  // Get event details for auto-generating title
  const { data: eventData } = await supabase
    .from("events")
    .select("name, event_date")
    .eq("id", finalEventId)
    .single<{ name: string; event_date: string }>();

  // Validate check-in/check-out dates (±10 days from event)
  if ((listingType === "room" || listingType === "room_and_bib") && checkIn && checkOut) {
    const eventDate = new Date(eventData!.event_date);
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    const minDate = new Date(eventDate);
    minDate.setDate(minDate.getDate() - 10);
    const maxDate = new Date(eventDate);
    maxDate.setDate(maxDate.getDate() + 10);

    if (checkInDate < minDate || checkInDate > maxDate) {
      return data({
        error: "Check-in date must be within 10 days before or after the event date"
      }, { status: 400 });
    }

    if (checkOutDate < minDate || checkOutDate > maxDate) {
      return data({
        error: "Check-out date must be within 10 days before or after the event date"
      }, { status: 400 });
    }

    if (checkOutDate <= checkInDate) {
      return data({
        error: "Check-out date must be after check-in date"
      }, { status: 400 });
    }
  }

  // Auto-generate title based on listing type and event
  const listingTypeText =
    listingType === "room" ? "Rooms" :
    listingType === "bib" ? "Bibs" :
    "Rooms + Bibs";

  const autoTitle = `${listingTypeText} for ${eventData?.name || "Marathon"}`;

  // Handle hotel - create or find existing
  let finalHotelId: string | null = null;
  let finalHotelNameFree: string | null = null;
  let finalHotelCity: string | null = null;
  let finalHotelCountry: string | null = null;

  if (listingType === "room" || listingType === "room_and_bib") {
    if (hotelPlaceId) {
      const { data: existingHotel } = await supabaseAdmin
        .from("hotels")
        .select("id")
        .eq("place_id", hotelPlaceId)
        .maybeSingle();

      if (existingHotel) {
        finalHotelId = (existingHotel as any).id;
      } else {
        const { data: newHotel, error: hotelError } = await supabaseAdmin
          .from("hotels")
          .insert({
            place_id: hotelPlaceId,
            name: hotelName,
            city: hotelCity,
            country: hotelCountry,
            website: hotelWebsite,
            lat: hotelLat ? parseFloat(hotelLat) : null,
            lng: hotelLng ? parseFloat(hotelLng) : null,
            rating: hotelRating ? parseFloat(hotelRating) : null,
          } as any)
          .select()
          .single();

        if (hotelError || !newHotel) {
          console.error("Hotel creation error:", hotelError);
          return data({ error: "Failed to create hotel" }, { status: 400 });
        }

        finalHotelId = (newHotel as any).id;
      }
    } else if (hotelName) {
      finalHotelNameFree = hotelName;
      finalHotelCity = hotelCity;
      finalHotelCountry = hotelCountry;
    }
  }

  // Create listing
  const { data: listing, error } = await supabaseAdmin
    .from("listings")
    .insert({
      author_id: user.id,
      event_id: finalEventId,
      listing_type: listingType as "room" | "bib" | "room_and_bib",
      title: autoTitle,
      description: description || null,
      hotel_name: hotelName || null,
      hotel_website: hotelWebsite || null,
      hotel_place_id: hotelPlaceId || null,
      hotel_id: finalHotelId,
      hotel_stars: null,
      hotel_lat: hotelLat ? parseFloat(hotelLat) : null,
      hotel_lng: hotelLng ? parseFloat(hotelLng) : null,
      hotel_rating: hotelRating ? parseFloat(hotelRating) : null,
      room_count: roomCount ? parseInt(roomCount) : null,
      room_type: roomType || null,
      check_in: checkIn || null,
      check_out: checkOut || null,
      bib_count: bibCount ? parseInt(bibCount) : null,
      price: price ? parseFloat(price) : null,
      price_negotiable: priceNegotiable,
      transfer_type: transferType || null,
      associated_costs: associatedCosts ? parseFloat(associatedCosts) : null,
      cost_notes: costNotes || null,
      status: "active",
    } as any)
    .select()
    .single<{ id: string }>();

  if (error) {
    console.error("Listing creation error:", error);
    return data({ error: "Failed to create listing" }, { status: 400 });
  }

  return redirect(`/listings/${listing.id}`);
}

export default function NewListing() {
  const { user, events, googlePlacesApiKey } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [listingType, setListingType] = useState<"room" | "bib" | "room_and_bib">("room");
  const [roomType, setRoomType] = useState<string>("");
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [transferMethod, setTransferMethod] = useState<TransferMethod | null>(null);

  useEffect(() => {
    const textarea = document.getElementById("description") as HTMLTextAreaElement;
    if (textarea && roomType === "other") {
      textarea.setCustomValidity(textarea.value ? "" : "Required");
      const handleInput = () => {
        textarea.setCustomValidity(textarea.value ? "" : "Required");
      };
      textarea.addEventListener("input", handleInput);
      return () => textarea.removeEventListener("input", handleInput);
    }
  }, [roomType]);

  const getDateConstraints = () => {
    if (!selectedEvent?.event_date) return { min: undefined, max: undefined };

    const eventDate = new Date(selectedEvent.event_date);
    const minDate = new Date(eventDate);
    minDate.setDate(minDate.getDate() - 7);
    const maxDate = new Date(eventDate);
    maxDate.setDate(maxDate.getDate() + 7);

    return {
      min: minDate.toISOString().split('T')[0],
      max: maxDate.toISOString().split('T')[0]
    };
  };

  const dateConstraints = getDateConstraints();
  const maxRooms = getMaxLimit(user.user_type, "rooms");
  const maxBibs = getMaxLimit(user.user_type, "bibs");
  const transferMethodOptions = getTransferMethodOptions(user.user_type);
  const visibleFields = getVisibleFieldsForTransferMethod(
    user.user_type,
    transferMethod,
    listingType as "bib" | "room_and_bib"
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <Header user={user} />

      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-stone-900 via-stone-800 to-emerald-900 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        
        <div className="relative mx-auto max-w-4xl px-6 py-16 lg:py-20">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">
                Create a Listing
              </h1>
              <p className="text-stone-300 mt-1">
                Share your available rooms or bibs with the community
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Container */}
      <main className="relative z-10 mx-auto max-w-4xl px-6 -mt-8 pb-20">
        <div className="bg-white rounded-2xl shadow-xl shadow-stone-200/50 border border-stone-100 overflow-hidden">
          <Form method="post" className="divide-y divide-stone-100" onSubmit={() => setFormSubmitted(true)}>
            
            {/* Error Message */}
            {actionData?.error && (
              <div className="p-6 bg-red-50 border-b border-red-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-red-700 font-medium">{actionData.error}</p>
                </div>
              </div>
            )}

            {/* Listing Type Selection */}
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                  1
                </div>
                <h2 className="text-lg font-semibold text-stone-900">What are you offering?</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Room Only */}
                <label className={`
                  relative flex cursor-pointer rounded-xl border-2 p-5 transition-all duration-200 hover:shadow-md
                  ${listingType === "room" 
                    ? "border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100" 
                    : "border-stone-200 bg-white hover:border-stone-300"}
                `}>
                  <input
                    type="radio"
                    name="listingType"
                    value="room"
                    className="sr-only"
                    defaultChecked
                    onChange={(e) => setListingType(e.target.value as "room")}
                  />
                  <span className="flex flex-1 flex-col items-center text-center">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                      listingType === "room" ? "bg-emerald-500 text-white" : "bg-stone-100 text-stone-500"
                    }`}>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <span className={`font-semibold ${listingType === "room" ? "text-emerald-700" : "text-stone-700"}`}>
                      Room Only
                    </span>
                    <span className="text-xs text-stone-500 mt-1">Hotel accommodation</span>
                  </span>
                  {listingType === "room" && (
                    <div className="absolute top-3 right-3 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </label>

                {/* Bib Only */}
                <label className={`
                  relative flex cursor-pointer rounded-xl border-2 p-5 transition-all duration-200 hover:shadow-md
                  ${listingType === "bib" 
                    ? "border-orange-500 bg-orange-50 shadow-md shadow-orange-100" 
                    : "border-stone-200 bg-white hover:border-stone-300"}
                `}>
                  <input
                    type="radio"
                    name="listingType"
                    value="bib"
                    className="sr-only"
                    onChange={(e) => setListingType(e.target.value as "bib")}
                  />
                  <span className="flex flex-1 flex-col items-center text-center">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                      listingType === "bib" ? "bg-orange-500 text-white" : "bg-stone-100 text-stone-500"
                    }`}>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                      </svg>
                    </div>
                    <span className={`font-semibold ${listingType === "bib" ? "text-orange-700" : "text-stone-700"}`}>
                      Bib Only
                    </span>
                    <span className="text-xs text-stone-500 mt-1">Race entry transfer</span>
                  </span>
                  {listingType === "bib" && (
                    <div className="absolute top-3 right-3 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </label>

                {/* Room + Bib */}
                <label className={`
                  relative flex cursor-pointer rounded-xl border-2 p-5 transition-all duration-200 hover:shadow-md
                  ${listingType === "room_and_bib" 
                    ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100" 
                    : "border-stone-200 bg-white hover:border-stone-300"}
                `}>
                  <input
                    type="radio"
                    name="listingType"
                    value="room_and_bib"
                    className="sr-only"
                    onChange={(e) => setListingType(e.target.value as "room_and_bib")}
                  />
                  <span className="flex flex-1 flex-col items-center text-center">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                      listingType === "room_and_bib" ? "bg-blue-500 text-white" : "bg-stone-100 text-stone-500"
                    }`}>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <span className={`font-semibold ${listingType === "room_and_bib" ? "text-blue-700" : "text-stone-700"}`}>
                      Room + Bib
                    </span>
                    <span className="text-xs text-stone-500 mt-1">Complete package</span>
                  </span>
                  {listingType === "room_and_bib" && (
                    <div className="absolute top-3 right-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Event Selection */}
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                  2
                </div>
                <h2 className="text-lg font-semibold text-stone-900">Running Event</h2>
              </div>
              
              <EventPicker
                events={events as any}
                onSelectEvent={(eventId: string) => {
                  const event = events.find((e: any) => e.id === eventId);
                  setSelectedEvent(event);
                }}
              />
            </div>

            {/* Room Details */}
            {(listingType === "room" || listingType === "room_and_bib") && (
              <div className="p-6 sm:p-8" id="roomFields">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                    3
                  </div>
                  <h2 className="text-lg font-semibold text-stone-900">Room Details</h2>
                </div>

                <div className="space-y-6">
                  {/* Hotel */}
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">
                      Hotel
                    </label>
                    <HotelAutocomplete
                      apiKey={googlePlacesApiKey}
                      eventCity={selectedEvent?.location}
                      eventCountry={selectedEvent?.country}
                      onSelectHotel={(hotel) => {}}
                    />
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    {/* Room Count */}
                    <div>
                      <label htmlFor="roomCount" className="block text-sm font-medium text-stone-700 mb-2">
                        Number of rooms
                        {maxRooms !== null && user.user_type === "tour_operator" && (
                          <span className="text-xs text-stone-400 ml-2">(max {maxRooms})</span>
                        )}
                      </label>
                      {user.user_type === "private" ? (
                        <>
                          <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-xl border border-stone-200">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/20">
                              1
                            </div>
                            <span className="text-sm text-stone-600">Private users can list 1 room only</span>
                          </div>
                          <input type="hidden" name="roomCount" value="1" />
                        </>
                      ) : (
                        <input
                          type="number"
                          id="roomCount"
                          name="roomCount"
                          min="1"
                          max={maxRooms || undefined}
                          placeholder="e.g. 2"
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                        />
                      )}
                    </div>

                    {/* Room Type */}
                    <div>
                      <label htmlFor="roomType" className="block text-sm font-medium text-stone-700 mb-2">
                        Room type
                      </label>
                      <select
                        id="roomType"
                        name="roomType"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none bg-white"
                        onChange={(e) => setRoomType(e.target.value)}
                      >
                        <option value="">Select type</option>
                        <option value="single">Single</option>
                        <option value="double">Double</option>
                        <option value="twin">Twin</option>
                        <option value="twin_shared">Twin Shared</option>
                        <option value="double_single_use">Double Single Use</option>
                        <option value="triple">Triple</option>
                        <option value="quadruple">Quadruple</option>
                        <option value="other">Other (specify in notes)</option>
                      </select>
                    </div>

                    {/* Check-in */}
                    <div>
                      <label htmlFor="checkIn" className="block text-sm font-medium text-stone-700 mb-2">
                        Check-in date
                      </label>
                      <input
                        type="date"
                        id="checkIn"
                        name="checkIn"
                        min={dateConstraints.min}
                        max={dateConstraints.max}
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                      />
                      {selectedEvent && (
                        <p className="mt-2 text-xs text-stone-500">
                          Event: {new Date(selectedEvent.event_date).toLocaleDateString()} (±7 days allowed)
                        </p>
                      )}
                    </div>

                    {/* Check-out */}
                    <div>
                      <label htmlFor="checkOut" className="block text-sm font-medium text-stone-700 mb-2">
                        Check-out date
                      </label>
                      <input
                        type="date"
                        id="checkOut"
                        name="checkOut"
                        min={dateConstraints.min}
                        max={dateConstraints.max}
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bib Details */}
            {(listingType === "bib" || listingType === "room_and_bib") && (
              <div className="p-6 sm:p-8" id="bibFields">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">
                    {listingType === "bib" ? "3" : "4"}
                  </div>
                  <h2 className="text-lg font-semibold text-stone-900">Bib Transfer Details</h2>
                </div>

                {/* Disclaimer for private users */}
                {user.user_type === "private" && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-sm text-blue-800">
                        <strong>Important:</strong> Runoot facilitates connections for legitimate bib transfers only. Direct sale of bibs may violate event regulations.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  {/* Bib Count */}
                  <div>
                    <label htmlFor="bibCount" className="block text-sm font-medium text-stone-700 mb-2">
                      Number of bibs
                      {maxBibs !== null && user.user_type === "tour_operator" && (
                        <span className="text-xs text-stone-400 ml-2">(max {maxBibs})</span>
                      )}
                    </label>
                    {user.user_type === "private" ? (
                      <>
                        <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-xl border border-stone-200">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-orange-500/20">
                            1
                          </div>
                          <span className="text-sm text-stone-600">Private users can list 1 bib only</span>
                        </div>
                        <input type="hidden" name="bibCount" value="1" />
                      </>
                    ) : (
                      <input
                        type="number"
                        id="bibCount"
                        name="bibCount"
                        min="1"
                        max={maxBibs || undefined}
                        placeholder="e.g. 1"
                        className="w-full sm:w-48 px-4 py-3 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                      />
                    )}
                  </div>

                  {/* Transfer Method */}
                  <div>
                    <label htmlFor="transferType" className="block text-sm font-medium text-stone-700 mb-2">
                      Transfer Method <span className="text-red-500">*</span>
                    </label>
                    {user.user_type === "private" ? (
                      <>
                        <div className="px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-700">
                          Official Organizer Name Change
                        </div>
                        <input type="hidden" name="transferType" value="official_process" />
                        <p className="mt-2 text-xs text-stone-500">
                          How the bib will be transferred to the new participant
                        </p>
                      </>
                    ) : (
                      <>
                        <select
                          id="transferType"
                          name="transferType"
                          className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all outline-none bg-white"
                          onChange={(e) => setTransferMethod(e.target.value as TransferMethod)}
                        >
                          <option value="">Select transfer method</option>
                          {transferMethodOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <p className="mt-2 text-xs text-stone-500">
                          How the bib will be transferred to the new participant
                        </p>
                      </>
                    )}
                  </div>

                  {/* Associated Costs */}
                  {visibleFields.showAssociatedCosts && (
                    <div>
                      <label htmlFor="associatedCosts" className="block text-sm font-medium text-stone-700 mb-2">
                        Associated Costs (€) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        id="associatedCosts"
                        name="associatedCosts"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 50"
                        required
                        className="w-full sm:w-48 px-4 py-3 rounded-xl border border-stone-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <p className="mt-2 text-xs text-stone-500">
                        Official name change fee from the event organizer
                      </p>
                    </div>
                  )}

                  {/* Package Info */}
                  {visibleFields.showPackageInfo && (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-sm text-emerald-800">
                          <strong>Package Transfer:</strong> The bib is included in your travel package. All costs are included in the package price.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Price */}
            {!(user.user_type === "private" && listingType === "bib") && (
              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                    {listingType === "room" ? "4" : listingType === "bib" ? "4" : "5"}
                  </div>
                  <h2 className="text-lg font-semibold text-stone-900">Pricing</h2>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="price" className="block text-sm font-medium text-stone-700 mb-2">
                      Price (€)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-stone-400">€</span>
                      </div>
                      <input
                        type="number"
                        id="price"
                        name="price"
                        min="0"
                        step="0.01"
                        placeholder="Leave empty for 'Contact for price'"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>

                  {(listingType === "room" || listingType === "room_and_bib") && (
                    <div className="flex items-end">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            name="priceNegotiable"
                            className="peer sr-only"
                          />
                          <div className="w-6 h-6 rounded-lg border-2 border-stone-300 peer-checked:border-emerald-500 peer-checked:bg-emerald-500 transition-all flex items-center justify-center">
                            <svg className="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                        <span className="text-sm text-stone-700 group-hover:text-stone-900">
                          Price is negotiable
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600 font-bold text-sm">
                  {listingType === "room" ? "5" : listingType === "bib" && user.user_type === "private" ? "4" : listingType === "bib" ? "5" : "6"}
                </div>
                <h2 className="text-lg font-semibold text-stone-900">
                  {user.user_type === "private" && listingType === "bib" ? "Notes" : "Additional Details"}
                </h2>
                <span className={`text-xs px-2 py-1 rounded-full ${roomType === "other" ? "bg-red-100 text-red-700" : "bg-stone-100 text-stone-500"}`}>
                  {roomType === "other" ? "Required" : "Optional"}
                </span>
              </div>

              <textarea
                id="description"
                name="description"
                rows={4}
                placeholder="Any other information runners should know..."
                className={`w-full px-4 py-3 rounded-xl border transition-all outline-none resize-none ${
                  roomType === "other" 
                    ? "border-red-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20" 
                    : "border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                }`}
                required={roomType === "other"}
              />
            </div>

            {/* Submit */}
            <div className="p-6 sm:p-8 bg-stone-50">
              <button
                type="submit"
                className="w-full sm:w-auto group inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5"
              >
                <span>Create Listing</span>
                <svg
                  className="w-5 h-5 transition-transform group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </Form>
        </div>
      </main>
    </div>
  );
}
