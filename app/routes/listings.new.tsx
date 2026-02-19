import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { Form, useActionData, useLoaderData, useNavigate } from "react-router";
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
import { calculateDistanceData } from "~/lib/distance.server";



export const meta: MetaFunction = () => {
  return [{ title: "Create Listing - RunStay Exchange" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  // Get existing events for autocomplete
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
  const currency = formData.get("currency") as string || "EUR";
  const priceNegotiable = formData.get("priceNegotiable") === "true";

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

  // Validate event is selected
  if (!eventId) {
    return data({ error: "Please select an event", field: "event" }, { status: 400 });
  }

  const finalEventId = eventId;

  // Get event details for auto-generating title and distance calculation
  const { data: eventData } = await supabase
    .from("events")
    .select("name, event_date, finish_lat, finish_lng")
    .eq("id", finalEventId)
    .single<{ name: string; event_date: string; finish_lat: number | null; finish_lng: number | null }>();

      // Validate hotel is required for room listings
  if ((listingType === "room" || listingType === "room_and_bib") && !hotelName) {
    return data({ error: "Please select or add a hotel", field: "hotel" }, { status: 400 });
  }

  // Validate room type is required for room listings
  if ((listingType === "room" || listingType === "room_and_bib") && !roomType) {
    return data({ error: "Please select a room type", field: "roomType" }, { status: 400 });
  }

  // Validate check-in/check-out dates (±10 days from event)
  if ((listingType === "room" || listingType === "room_and_bib") && checkIn && checkOut) {
    const eventDate = new Date(eventData!.event_date);
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    
    // Calculate min/max dates (±10 days from event)
    const minDate = new Date(eventDate);
    minDate.setDate(minDate.getDate() - 10);
    const maxDate = new Date(eventDate);
    maxDate.setDate(maxDate.getDate() + 10);
    
    // Validate check-in
    if (checkInDate < minDate || checkInDate > maxDate) {
      return data({ 
        error: "Check-in date must be within 10 days before or after the event date" 
      }, { status: 400 });
    }
    
    // Validate check-out
    if (checkOutDate < minDate || checkOutDate > maxDate) {
      return data({ 
        error: "Check-out date must be within 10 days before or after the event date" 
      }, { status: 400 });
    }
    
    // Validate check-out is after check-in
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
      // Hotel from Google Places - check if exists or create
      const { data: existingHotel } = await supabaseAdmin
        .from("hotels")
        .select("id")
        .eq("place_id", hotelPlaceId)
        .maybeSingle();

      if (existingHotel) {
                finalHotelId = (existingHotel as any).id;
      } else {
        // Create new hotel (usa supabaseAdmin per bypassare RLS)
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
      // Manual hotel entry - save as free text
      finalHotelNameFree = hotelName;
      finalHotelCity = hotelCity;
      finalHotelCountry = hotelCountry;
    }
  }


  // Calculate distance to finish line (only for room listings with hotel coordinates)
  const distanceData = await calculateDistanceData(
    hotelLat ? parseFloat(hotelLat) : null,
    hotelLng ? parseFloat(hotelLng) : null,
    eventData?.finish_lat ?? null,
    eventData?.finish_lng ?? null,
    eventData?.event_date // Pass event date for transit departure time (2pm on event day)
  );

  // Create listing (usa supabaseAdmin per bypassare RLS)
  const { data: listing, error } = await supabaseAdmin
  .from("listings")
  .insert({
    author_id: user.id,
    event_id: finalEventId,
    listing_type: listingType as "room" | "bib" | "room_and_bib",
    title: autoTitle,
    description: description || null,

    // Campi hotel
    hotel_name: hotelName || null,
    hotel_website: hotelWebsite || null,
    hotel_place_id: hotelPlaceId || null,
    hotel_id: finalHotelId,
    hotel_stars: null,
    hotel_lat: hotelLat ? parseFloat(hotelLat) : null,
    hotel_lng: hotelLng ? parseFloat(hotelLng) : null,
    hotel_rating: hotelRating ? parseFloat(hotelRating) : null,

    // Campi room
    room_count: roomCount ? parseInt(roomCount) : null,
    room_type: roomType || null,
    check_in: checkIn || null,
    check_out: checkOut || null,
    bib_count: bibCount ? parseInt(bibCount) : null,

    // Price fields
    price: price ? parseFloat(price) : null,
    currency: currency,
    price_negotiable: priceNegotiable,

    // Transfer fields
    transfer_type: transferType || null,
    associated_costs: associatedCosts ? parseFloat(associatedCosts) : null,
    cost_notes: costNotes || null,

    // Distance to finish line
    distance_to_finish: distanceData.distance_to_finish,
    walking_duration: distanceData.walking_duration,
    transit_duration: distanceData.transit_duration,

    status: "pending",
    }as any)
    .select()
    .single<{ id: string }>();

  if (error) {
    console.error("Listing creation error:", error);
    return data({ error: "Failed to create listing" }, { status: 400 });
  }

  return data({ success: true, listingId: listing.id });
}

export default function NewListing() {
  const { user, events, googlePlacesApiKey } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const [listingType, setListingType] = useState<"room" | "bib" | "room_and_bib">("room");
  const [roomType, setRoomType] = useState<string>("");
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [transferMethod, setTransferMethod] = useState<TransferMethod | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);
  const [checkInDate, setCheckInDate] = useState<Date | null>(null);
  const [currency, setCurrency] = useState<string>("EUR");
  const [priceValue, setPriceValue] = useState<string>("");
  const [priceNegotiable, setPriceNegotiable] = useState<boolean | null>(null);

  // Show success modal when listing is created
  useEffect(() => {
    if (actionData?.success && actionData?.listingId) {
      setCreatedListingId(actionData.listingId);
      setShowSuccessModal(true);
    }
  }, [actionData]);

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

  // Calcola date min/max basate sull'evento (±7 giorni)
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
  const maxRooms = getMaxLimit(user.user_type, "rooms");
  const maxBibs = getMaxLimit(user.user_type, "bibs");

  // Get available transfer methods for this user type
  const transferMethodOptions = getTransferMethodOptions(user.user_type);

  // Get visible fields based on transfer method selection
  const visibleFields = getVisibleFieldsForTransferMethod(
    user.user_type,
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
        <main className="mx-auto max-w-2xl px-4 py-8 pb-8 md:pb-8 sm:px-6 lg:px-8">
          <div className="mb-6 md:mb-8 rounded-xl bg-white/70 backdrop-blur-sm p-3 md:p-4 inline-block shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
            <h1 className="font-display text-xl md:text-3xl font-bold text-gray-900">
              Create a Listing
            </h1>
            <p className="mt-1 md:mt-2 text-sm md:text-base text-gray-600">
              Share your available rooms or bibs with the community
            </p>
          </div>

          <div className="rounded-2xl bg-white/90 backdrop-blur-sm p-6 sm:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
          <Form method="post" className="space-y-8" onSubmit={() => setFormSubmitted(true)}>
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
                    defaultChecked
                    onChange={(e) => setListingType(e.target.value as "room")}
                  />
                  <span className="flex flex-1 flex-col items-center text-center">
                    <svg
                      className="h-6 w-6 text-gray-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                    <span className="mt-2 text-sm font-medium text-gray-900">
                      Room Only
                    </span>
                  </span>
                </label>
                <label className="relative flex cursor-pointer rounded-lg bg-white p-4 shadow-sm focus:outline-none transition-all hover:ring-2 hover:ring-purple-300 has-[:checked]:bg-purple-100 has-[:checked]:ring-2 has-[:checked]:ring-purple-500">
                  <input
                    type="radio"
                    name="listingType"
                    value="bib"
                    className="sr-only"
                    onChange={(e) => setListingType(e.target.value as "bib")}
                  />
                  <span className="flex flex-1 flex-col items-center text-center">
                    <svg
                      className="h-6 w-6 text-gray-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                      />
                    </svg>
                    <span className="mt-2 text-sm font-medium text-gray-900">
                      Bib Only
                    </span>
                  </span>
                </label>
                <label className="relative flex cursor-pointer rounded-lg bg-white p-4 shadow-sm focus:outline-none transition-all hover:ring-2 hover:ring-green-300 has-[:checked]:bg-green-100 has-[:checked]:ring-2 has-[:checked]:ring-green-500">
                  <input
                    type="radio"
                    name="listingType"
                    value="room_and_bib"
                    className="sr-only"
                    onChange={(e) => setListingType(e.target.value as "room_and_bib")}
                  />
                  <span className="flex flex-1 flex-col items-center text-center">
                    <svg
                      className="h-6 w-6 text-gray-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <span className="mt-2 text-sm font-medium text-gray-900">
                      Room + Bib
                    </span>
                  </span>
                </label>
              </div>
            </div>



            {/* Event Selection with Modal */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">
                Running Event
              </h3>
              <EventPicker
                events={events as any}
                onSelectEvent={(eventId: string) => {
                  const event = events.find((e: any) => e.id === eventId);
                  setSelectedEvent(event);
                }}
                hasError={actionData?.field === "event"}
              />
            </div>

            {/* Room Details */}
            {(listingType === "room" || listingType === "room_and_bib") && (
            <div className="space-y-4" id="roomFields">
              <h3 className="font-medium text-gray-900 border-b pb-2">
                Room Details
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                  <label className="label">Hotel</label>
                                   <HotelAutocomplete
                    apiKey={googlePlacesApiKey}
                    eventCity={selectedEvent?.country}
                    eventCountry={selectedEvent?.country}
                    onSelectHotel={(hotel) => {
                      // Hotel data is handled via hidden inputs in component
                    }}
                    hasError={actionData?.field === "hotel"}
                  />

                </div>
<div> </div>
  <div> </div>              
                <div>
                <label htmlFor="roomCount" className="label mb-3">
                   Number of rooms
                  {maxRooms !== null && user.user_type === "tour_operator" && (
                  <span className="text-xs text-gray-500 ml-2">(max {maxRooms} for your account)</span>
                  )}
                  </label>
                  {user.user_type === "private" ? (
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
                    placeholder="e.g. 2"
                   className="input"
                  />
                   )}
                </div>

<RoomTypeDropdown
  value={roomType}
  onChange={setRoomType}
  hasError={actionData?.field === "roomType"}
/>

                <div className="mt-4">
                  <label htmlFor="checkIn" className="label mb-3">
                    Check-in
                  </label>
                  <DatePicker
                    id="checkIn"
                    name="checkIn"
                    placeholder="dd/mm/yyyy"
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
                  <label htmlFor="checkOut" className="label mb-3">
                    Check-out
                  </label>
                  <DatePicker
                    id="checkOut"
                    name="checkOut"
                    placeholder="dd/mm/yyyy"
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
  <h3 className="font-medium text-gray-900 border-b pb-2">
    Bib Transfer Details
  </h3>
  
  {/* Disclaimer - solo per utenti privati */}
  {user.user_type === "private" && (
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
    {maxBibs !== null && user.user_type === "tour_operator" && (
      <span className="text-xs text-gray-500 ml-2">(max {maxBibs} for your account)</span>
    )}
  </label>
  {user.user_type === "private" ? (
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
      placeholder="e.g. 1"
      className="input w-full sm:w-48"
    />
  )}
</div>

  
    <div>
    <label htmlFor="transferType" className="label">
      Transfer Method <span className="text-red-500">*</span>
    </label>
    {user.user_type === "private" ? (
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


  {/* Associated costs - show based on transfer method and listing type */}
  {visibleFields.showAssociatedCosts && (
    <div>
      <label htmlFor="associatedCosts" className="label">
        Associated Costs (€) <span className="text-gray-400">(optional)</span>
      </label>
      <input
        type="number"
        id="associatedCosts"
        name="associatedCosts"
        min="0"
        step="0.01"
        placeholder="e.g. 50"
        className="input [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <p className="mt-1 text-xs text-gray-500">
        Official name change fee from the event organizer (if applicable)
      </p>
    </div>
  )}

  {/* Package info - show when "package" is selected */}
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
            {/* Price - nascondi per privati con bib only */}
            {!(user.user_type === "private" && listingType === "bib") && (
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 border-b pb-2">
                  Price
                </h3>
                <div>
                  <label htmlFor="price" className="label mb-3">
                    Amount
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      id="price"
                      name="price"
                      min="0"
                      step="0.01"
                      placeholder=""
                      className="input w-32 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={priceValue}
                      onChange={(e) => {
                        setPriceValue(e.target.value);
                        // Reset negotiable to null when price is cleared
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
                  <p className="mt-1.5 text-sm text-gray-500">
                    Leave empty = Contact for price
                  </p>
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
  {user.user_type === "private" && listingType === "bib" ? "Notes" : "Additional details"}{" "}
  <span className={roomType === "other" ? "text-red-500" : "text-gray-400"}>
    {roomType === "other" ? "(required)" : "(optional)"}
  </span>
</label>
             <textarea
  id="description"
  name="description"
  rows={4}
  placeholder="Any other information runners should know..."
  className={`input ${roomType === "other" ? "required:border-red-500 invalid:border-red-500 focus:invalid:ring-red-500" : ""}`}
  required={roomType === "other"}
/>
            </div>

            {/* Error Message */}
            {actionData?.error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center gap-2">
                <svg className="h-5 w-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {actionData.error}
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-4 pt-4">
              <button type="submit" className="btn-primary flex-1 rounded-full">
                Create Listing
              </button>
            </div>
          </Form>
          </div>
        </main>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Modal Content */}
            <div
              className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl text-center"
              style={{ animation: "fade-in-up 0.3s ease-out" }}
            >
              {/* Success Animation - colore basato sul listing type */}
              <div
                className={`mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full ${
                  listingType === "room"
                    ? "bg-blue-100"
                    : listingType === "bib"
                    ? "bg-purple-100"
                    : "bg-green-100"
                }`}
                style={{ animation: "scale-in 0.4s ease-out" }}
              >
                <svg
                  className={`h-12 w-12 ${
                    listingType === "room"
                      ? "text-blue-600"
                      : listingType === "bib"
                      ? "text-purple-600"
                      : "text-green-600"
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              {/* Title */}
              <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">
                Listing Submitted!
              </h2>

              {/* Message */}
              <p className="text-gray-600 mb-8">
                Your listing has been submitted and is pending review. We'll notify you once it's approved and visible to other users.
              </p>

              {/* Buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => navigate(`/listings/${createdListingId}`)}
                  className="btn-primary w-full py-3 rounded-full"
                >
                  View Your Listing
                </button>
                {user.user_type === "tour_operator" && (
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      navigate("/dashboard");
                    }}
                    className="btn bg-gray-100 text-gray-700 hover:bg-gray-200 w-full py-3 rounded-full"
                  >
                    Go to Dashboard
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
