import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, useActionData, useLoaderData, Link, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { requireUser } from "~/lib/session.server";
import { supabase, supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";
import { EventPicker } from "~/components/EventPicker";
import { HotelAutocomplete } from "~/components/HotelAutocomplete";
import { DatePicker } from "~/components/DatePicker";
import { RoomTypeDropdown } from "~/components/RoomTypeDropdown";
import { CurrencyPicker } from "~/components/CurrencyPicker";
import {
  getMaxLimit,
  getTransferMethodOptions,
  getVisibleFieldsForTransferMethod,
  validateListingLimits
} from "~/config/listing-rules";
import type { TransferMethod } from "~/config/listing-rules";

export const meta: MetaFunction = () => {
  return [{ title: "Edit Listing - Runoot" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const { id } = params;

  // Get the listing
  const { data: listing, error } = await supabase
    .from("listings")
    .select(`
      *,
      event:events(id, name, country, event_date)
    `)
    .eq("id", id!)
    .single();

  if (error || !listing) {
    throw new Response("Listing not found", { status: 404 });
  }

  // Check ownership
  if ((listing as any).author_id !== (user as any).id) {
    throw new Response("Unauthorized", { status: 403 });
  }

  // Get existing events for autocomplete
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: true });

  return {
    user,
    listing,
    events: events || [],
    googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || ""
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const { id } = params;

  // Verify ownership
  const { data: existingListing } = await supabase
    .from("listings")
    .select("author_id")
    .eq("id", id!)
    .single();

  if (!existingListing || (existingListing as any).author_id !== (user as any).id) {
    return data({ error: "Unauthorized" }, { status: 403 });
  }

  const formData = await request.formData();

  const listingType = formData.get("listingType") as string;
  const description = formData.get("description") as string;

  // Event fields
  const eventId = formData.get("eventId") as string;
  const newEventName = formData.get("newEventName") as string;
  const newEventCountry = formData.get("newEventCountry") as string;
  const newEventDate = formData.get("newEventDate") as string;

  // Hotel fields
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
  const priceNegotiable = formData.get("priceNegotiable") === "true";

  // Validation
  if (!listingType) {
    return data({ error: "Please select a listing type" }, { status: 400 });
  }

  // Validate user type limits
  const validation = validateListingLimits(
    (user as any).user_type,
    roomCount ? parseInt(roomCount) : null,
    bibCount ? parseInt(bibCount) : null,
    transferType
  );

  if (!validation.valid) {
    return data({ error: validation.error }, { status: 400 });
  }

  // Handle event
  let finalEventId = eventId;

  if (!eventId && newEventName && newEventDate) {
    const { data: newEvent, error: eventError } = await supabase
      .from("events")
      .insert({
        name: newEventName,
        country: newEventCountry || "",
        event_date: newEventDate,
        created_by: (user as any).id,
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

  // Get event details for title
  const { data: eventData } = await supabase
    .from("events")
    .select("name, event_date")
    .eq("id", finalEventId)
    .single<{ name: string; event_date: string }>();

  // Validate dates
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

  // Auto-generate title
  const listingTypeText =
    listingType === "room" ? "Rooms" :
    listingType === "bib" ? "Bibs" :
    "Rooms + Bibs";

  const autoTitle = `${listingTypeText} for ${eventData?.name || "Marathon"}`;

  // Handle hotel
  let finalHotelId: string | null = null;

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
    }
  }

  // Update listing
  const { error } = await supabaseAdmin
    .from("listings")
    .update({
      event_id: finalEventId,
      listing_type: listingType as "room" | "bib" | "room_and_bib",
      title: autoTitle,
      description: description || null,

      // Hotel fields
      hotel_name: hotelName || null,
      hotel_website: hotelWebsite || null,
      hotel_place_id: hotelPlaceId || null,
      hotel_id: finalHotelId,
      hotel_stars: null,
      hotel_lat: hotelLat ? parseFloat(hotelLat) : null,
      hotel_lng: hotelLng ? parseFloat(hotelLng) : null,
      hotel_rating: hotelRating ? parseFloat(hotelRating) : null,

      // Room fields
      room_count: roomCount ? parseInt(roomCount) : null,
      room_type: roomType || null,
      check_in: checkIn || null,
      check_out: checkOut || null,
      bib_count: bibCount ? parseInt(bibCount) : null,

      // Price
      price: price ? parseFloat(price) : null,
      price_negotiable: priceNegotiable,

      // Bib transfer
      transfer_type: transferType || null,
      associated_costs: associatedCosts ? parseFloat(associatedCosts) : null,
      cost_notes: costNotes || null,
    } as any)
    .eq("id", id!);

  if (error) {
    console.error("Listing update error:", error);
    return data({ error: "Failed to update listing" }, { status: 400 });
  }

  return redirect(`/listings/${id}`);
}

export default function EditListing() {
  const { user, listing, events, googlePlacesApiKey } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const actionErrorField =
    actionData && "field" in actionData ? actionData.field : undefined;
  const actionErrorMessage =
    actionData && "error" in actionData ? actionData.error : undefined;
  const navigate = useNavigate();

  const listingData = listing as any;

  const [listingType, setListingType] = useState<"room" | "bib" | "room_and_bib">(listingData.listing_type);
  const [roomType, setRoomType] = useState<string>(listingData.room_type || "");
  const [selectedEvent, setSelectedEvent] = useState<any>(listingData.event);
  const [transferMethod, setTransferMethod] = useState<TransferMethod | null>(listingData.transfer_type);
  const [checkInDate, setCheckInDate] = useState<Date | null>(listingData.check_in ? new Date(listingData.check_in) : null);
  const [currency, setCurrency] = useState<string>(listingData.currency || "EUR");
  const [priceValue, setPriceValue] = useState<string>(listingData.price?.toString() || "");
  const [priceNegotiable, setPriceNegotiable] = useState<boolean | null>(listingData.price_negotiable === true ? true : listingData.price_negotiable === false ? false : null);

  // Custom validation message
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

  // Date constraints
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

  // Get max limits based on user type
  const maxRooms = getMaxLimit((user as any).user_type, "rooms");
  const maxBibs = getMaxLimit((user as any).user_type, "bibs");

  // Get available transfer methods for this user type
  const transferMethodOptions = getTransferMethodOptions((user as any).user_type);

  // Get visible fields based on transfer method selection
  const visibleFields = getVisibleFieldsForTransferMethod(
    (user as any).user_type,
    transferMethod,
    listingType as "bib" | "room_and_bib"
  );

  return (
    <div className="min-h-full bg-gray-50">
      <Header user={user} />

      {/* Container con immagine di sfondo ai lati */}
      <div
        className="min-h-screen bg-cover bg-center bg-no-repeat bg-fixed"
        style={{ backgroundImage: "url('/new-listing.jpg')" }}
      >
        <main className="mx-auto max-w-2xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8">
          <div className="mb-8 rounded-xl bg-white/70 backdrop-blur-sm p-4 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
            <Link
              to={`/listings/${listingData.id}`}
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 underline"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to listing
            </Link>
            <h1 className="font-display text-3xl font-bold text-gray-900">
              Edit Listing
            </h1>
            <p className="mt-2 text-gray-600">
              Update your listing details
            </p>
          </div>

          <div className="rounded-2xl bg-white/90 backdrop-blur-sm p-6 sm:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
          <Form method="post" className="space-y-8">
            {/* Listing Type */}
            <div>
              <label className="label">What are you offering?</label>
              <div className="mt-2 grid grid-cols-3 gap-3">
                <label className="relative flex cursor-pointer rounded-lg bg-white p-4 shadow-sm focus:outline-none transition-all hover:ring-2 hover:ring-blue-300 has-[:checked]:bg-blue-100 has-[:checked]:ring-2 has-[:checked]:ring-blue-500">
                  <input
                    type="radio"
                    name="listingType"
                    value="room"
                    className="sr-only"
                    defaultChecked={listingType === "room"}
                    onChange={(e) => setListingType(e.target.value as "room")}
                  />
                  <span className="flex flex-1 flex-col items-center text-center">
                    <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className="mt-2 text-sm font-medium text-gray-900">Room Only</span>
                  </span>
                </label>
                <label className="relative flex cursor-pointer rounded-lg bg-white p-4 shadow-sm focus:outline-none transition-all hover:ring-2 hover:ring-purple-300 has-[:checked]:bg-purple-100 has-[:checked]:ring-2 has-[:checked]:ring-purple-500">
                  <input
                    type="radio"
                    name="listingType"
                    value="bib"
                    className="sr-only"
                    defaultChecked={listingType === "bib"}
                    onChange={(e) => setListingType(e.target.value as "bib")}
                  />
                  <span className="flex flex-1 flex-col items-center text-center">
                    <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                    <span className="mt-2 text-sm font-medium text-gray-900">Bib Only</span>
                  </span>
                </label>
                <label className="relative flex cursor-pointer rounded-lg bg-white p-4 shadow-sm focus:outline-none transition-all hover:ring-2 hover:ring-green-300 has-[:checked]:bg-green-100 has-[:checked]:ring-2 has-[:checked]:ring-green-500">
                  <input
                    type="radio"
                    name="listingType"
                    value="room_and_bib"
                    className="sr-only"
                    defaultChecked={listingType === "room_and_bib"}
                    onChange={(e) => setListingType(e.target.value as "room_and_bib")}
                  />
                  <span className="flex flex-1 flex-col items-center text-center">
                    <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="mt-2 text-sm font-medium text-gray-900">Room + Bib</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Event Selection */}
            <div>
              <label className="label">Running Event</label>
              <EventPicker
                events={events as any}
                defaultEventId={listingData.event?.id}
                onSelectEvent={(eventId: string) => {
                  const event = events.find((e: any) => e.id === eventId);
                  setSelectedEvent(event);
                }}
              />
            </div>

            {/* Room Details */}
            {(listingType === "room" || listingType === "room_and_bib") && (
              <div className="space-y-4" id="roomFields">
                <h3 className="font-medium text-gray-900 border-b pb-2">Room Details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="label">Hotel</label>
                    <HotelAutocomplete
                      apiKey={googlePlacesApiKey}
                      eventCity={selectedEvent?.country}
                      eventCountry={selectedEvent?.country}
                      defaultHotelName={listingData.hotel_name}
                      onSelectHotel={(hotel) => {}}
                    />
                  </div>
                  <div></div>
                  <div></div>
                  <div>
                    <label htmlFor="roomCount" className="label">
                      Number of rooms
                      {maxRooms !== null && (user as any).user_type === "tour_operator" && (
                        <span className="text-xs text-gray-500 ml-2">(max {maxRooms} for your account)</span>
                      )}
                    </label>
                    {(user as any).user_type === "private" ? (
                      <>
                        <div className="flex items-center gap-3 mt-2">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-lg font-bold text-2xl shadow-[0_2px_8px_rgba(0,0,0,0.15)] ${listingType === "room" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                            1
                          </div>
                          <span className="text-sm text-gray-600">Private users can list<br />1 room only</span>
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
                        defaultValue={listingData.room_count || ""}
                        placeholder="e.g. 2"
                        className="input"
                      />
                    )}
                  </div>

                  <RoomTypeDropdown
                  value={roomType}
                  onChange={setRoomType}
                  hasError={actionErrorField === "roomType"}
                />

                  <div className="mt-4">
                    <label htmlFor="checkIn" className="label mb-3">Check-in</label>
                    <DatePicker
                      id="checkIn"
                      name="checkIn"
                      placeholder="dd/mm/yyyy"
                      defaultValue={listingData.check_in || undefined}
                      minDate={dateConstraints.min ? new Date(dateConstraints.min) : undefined}
                      maxDate={dateConstraints.max ? new Date(dateConstraints.max) : undefined}
                      onChange={(date) => setCheckInDate(date)}
                    />
                    {selectedEvent && (
                      <p className="mt-1 text-xs text-gray-500">
                        Event date: {new Date(selectedEvent.event_date).toLocaleDateString()} (±7 days)
                      </p>
                    )}
                  </div>

                  <div className="mt-4">
                    <label htmlFor="checkOut" className="label mb-3">Check-out</label>
                    <DatePicker
                      id="checkOut"
                      name="checkOut"
                      placeholder="dd/mm/yyyy"
                      defaultValue={listingData.check_out || undefined}
                      minDate={checkInDate || (dateConstraints.min ? new Date(dateConstraints.min) : undefined)}
                      maxDate={dateConstraints.max ? new Date(dateConstraints.max) : undefined}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Bib Details */}
            {(listingType === "bib" || listingType === "room_and_bib") && (
              <div className="space-y-4" id="bibFields">
                <h3 className="font-medium text-gray-900 border-b pb-2">Bib Transfer Details</h3>

                {(user as any).user_type === "private" && (
                  <div className={`rounded-lg p-4 ${listingType === "bib" ? "bg-purple-50 border border-purple-200" : "bg-green-50 border border-green-200"}`}>
                    <p className={`text-sm ${listingType === "bib" ? "text-purple-800" : "text-green-800"}`}>
                      <strong>Important:</strong> runoot facilitates connections for legitimate
                      bib transfers only. Direct sale of bibs may violate event regulations.
                    </p>
                  </div>
                )}

                <div>
                  <label htmlFor="bibCount" className="label">
                    Number of bibs
                    {maxBibs !== null && (user as any).user_type === "tour_operator" && (
                      <span className="text-xs text-gray-500 ml-2">(max {maxBibs} for your account)</span>
                    )}
                  </label>
                  {(user as any).user_type === "private" ? (
                    <>
                      <div className="flex items-center gap-3 mt-2">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-lg font-bold text-2xl shadow-[0_2px_8px_rgba(0,0,0,0.15)] ${listingType === "bib" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}>
                          1
                        </div>
                        <span className="text-sm text-gray-600">Private users can list 1 bib only</span>
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
                      defaultValue={listingData.bib_count || ""}
                      placeholder="e.g. 1"
                      className="input w-full sm:w-48"
                    />
                  )}
                </div>

                <div>
                  <label htmlFor="transferType" className="label">
                    Transfer Method <span className="text-red-500">*</span>
                  </label>
                  {(user as any).user_type === "private" ? (
                    <>
                      <div className="mt-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                        Official Organizer Name Change
                      </div>
                      <input type="hidden" name="transferType" value="official_process" />
                      <p className="mt-1 text-xs text-gray-500">
                        How the bib will be transferred to the new participant
                      </p>
                    </>
                  ) : (
                    <>
                      <select
                        id="transferType"
                        name="transferType"
                        className="input"
                        defaultValue={listingData.transfer_type || ""}
                        onChange={(e) => setTransferMethod(e.target.value as TransferMethod)}
                      >
                        <option value="">Select transfer method</option>
                        {transferMethodOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        How the bib will be transferred to the new participant
                      </p>
                    </>
                  )}
                </div>

                {visibleFields.showPackageInfo && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800">
                      <strong>Package Transfer:</strong> The bib is included in your travel package.
                      All costs are included in the package price.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Price */}
            {!((user as any).user_type === "private" && listingType === "bib") && (
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 border-b pb-2">Price</h3>
                <div>
                  <label htmlFor="price" className="label mb-3">Amount</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      id="price"
                      name="price"
                      min="0"
                      step="0.01"
                      placeholder="Empty = Contact for price"
                      className="input w-[205px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-sm placeholder:font-sans"
                      value={priceValue}
                      onChange={(e) => {
                        setPriceValue(e.target.value);
                        if (!e.target.value) {
                          setPriceNegotiable(null);
                        }
                      }}
                    />
                    <CurrencyPicker
                      value={currency}
                      onChange={setCurrency}
                    />
                  </div>
                </div>

                {/* Price negotiable - appare solo quando c'è un prezzo */}
                {priceValue && (listingType === "room" || listingType === "room_and_bib") && (
                  <div className="mt-4">
                    <input type="hidden" name="priceNegotiable" value={priceNegotiable === true ? "true" : "false"} />
                    <span className="text-sm text-gray-700">Is the price negotiable?</span>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setPriceNegotiable(priceNegotiable === true ? null : true)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          priceNegotiable === true
                            ? "bg-green-100 text-green-700 ring-2 ring-green-500 shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                            : "bg-white text-gray-700 shadow-sm hover:ring-2 hover:ring-green-300"
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriceNegotiable(priceNegotiable === false ? null : false)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          priceNegotiable === false
                            ? "bg-green-100 text-green-700 ring-2 ring-green-500 shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                            : "bg-white text-gray-700 shadow-sm hover:ring-2 hover:ring-green-300"
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <label htmlFor="description" className="label">
                {(user as any).user_type === "private" && listingType === "bib" ? "Notes" : "Additional details"}{" "}
                <span className={roomType === "other" ? "text-red-500" : "text-gray-400"}>
                  {roomType === "other" ? "(required)" : "(optional)"}
                </span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={listingData.description || ""}
                placeholder="Any other information runners should know..."
                className={`input ${roomType === "other" ? "required:border-red-500 invalid:border-red-500 focus:invalid:ring-red-500" : ""}`}
                required={roomType === "other"}
              />
            </div>

            {/* Error Message */}
            {actionErrorMessage && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center gap-2">
                <svg className="h-5 w-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {actionErrorMessage}
              </div>
            )}

            {/* Submit */}
            <div className="pt-4">
              <button type="submit" className="btn-primary w-full rounded-full">
                Save Changes
              </button>
            </div>
          </Form>
          </div>
        </main>
      </div>
    </div>
  );
}
