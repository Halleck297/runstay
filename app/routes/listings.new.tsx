import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, useActionData, useLoaderData, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { requireUser } from "~/lib/session.server";
import { supabase, supabaseAdmin } from "~/lib/supabase.server";
import { getListingPublicId } from "~/lib/publicIds";
import { Header } from "~/components/Header";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { tourOperatorNavItems } from "~/components/panelNav";
import { EventPicker } from "~/components/EventPicker";
import { HotelAutocomplete } from "~/components/HotelAutocomplete";
import { DatePicker } from "~/components/DatePicker";
import { RoomTypeDropdown } from "~/components/RoomTypeDropdown";
import { CurrencyPicker } from "~/components/CurrencyPicker";
import { TransferMethodDropdown } from "~/components/TransferMethodDropdown";
import { useI18n } from "~/hooks/useI18n";
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

const TO_ROOM_TYPES = [
  "single",
  "double",
  "double_single_use",
  "twin",
  "twin_shared",
  "triple",
  "quadruple",
] as const;

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const pathname = new URL(request.url).pathname;
  if (user.user_type === "tour_operator" && pathname === "/listings/new") {
    return redirect("/to-panel/listings/new");
  }

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
  const pathname = new URL(request.url).pathname;
  if (user.user_type === "tour_operator" && pathname === "/listings/new") {
    return redirect("/to-panel/listings/new");
  }
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
  const roomTypes = formData
    .getAll("roomTypes")
    .map((v) => String(v))
    .filter((v) => TO_ROOM_TYPES.includes(v as any));
  const flexibleDates = formData.get("flexibleDates") === "on";
  const extraNightEnabled = formData.get("extraNightEnabled") === "on";
  const extraNightPriceRaw = String(formData.get("extraNightPrice") || "").trim();
  const extraNightPriceUnitRaw = String(formData.get("extraNightPriceUnit") || "per_person").trim();
  const extraNightPriceUnit = extraNightPriceUnitRaw === "per_room" ? "per_room" : "per_person";

  // Validation
  if (!listingType) {
    return data({ errorKey: "select_listing_type" as const }, { status: 400 });
  }

  if ((listingType === "room" || listingType === "room_and_bib") && (!checkIn || !checkOut)) {
    return data({ error: "Check-in and check-out are required for room listings." }, { status: 400 });
  }

  // TO listings require an explicit price for all listing types (room, bib, package).
  if (user.user_type === "tour_operator") {
    const parsedPrice = Number.parseFloat(price || "");
    if (!Number.isFinite(parsedPrice) || Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      return data({ error: "Price is required and must be greater than 0." }, { status: 400 });
    }
  }

  const toRoomTypePrices: Record<string, number> = {};
  if (user.user_type === "tour_operator" && (listingType === "room" || listingType === "room_and_bib")) {
    if (roomTypes.length === 0) {
      return data({ error: "Select at least one room type." }, { status: 400 });
    }

    if (!roomCount || Number.parseInt(roomCount, 10) <= 0) {
      return data({ error: "Number of rooms must be greater than 0." }, { status: 400 });
    }

    for (const rt of roomTypes) {
      const raw = String(formData.get(`roomPrice_${rt}`) || "").trim();
      const parsed = Number.parseFloat(raw);
      if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed <= 0) {
        return data({ error: `Price for ${rt} room type is required and must be greater than 0.` }, { status: 400 });
      }
      toRoomTypePrices[rt] = parsed;
    }
  }

  let extraNightPrice: number | null = null;
  if (user.user_type === "tour_operator" && extraNightEnabled) {
    const parsed = Number.parseFloat(extraNightPriceRaw);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed <= 0) {
      return data({ error: "Extra night price must be greater than 0 when enabled." }, { status: 400 });
    }
    extraNightPrice = parsed;
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
    return data({ errorKey: "select_event" as const, field: "event" }, { status: 400 });
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
    return data({ errorKey: "select_or_add_hotel" as const, field: "hotel" }, { status: 400 });
  }

  // Validate room type is required for room listings
  if ((listingType === "room" || listingType === "room_and_bib") && !roomType) {
    return data({ errorKey: "select_room_type" as const, field: "roomType" }, { status: 400 });
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
        errorKey: "checkin_window" as const
      }, { status: 400 });
    }
    
    // Validate check-out
    if (checkOutDate < minDate || checkOutDate > maxDate) {
      return data({ 
        errorKey: "checkout_window" as const
      }, { status: 400 });
    }
    
    // Validate check-out is after check-in
    if (checkOutDate <= checkInDate) {
      return data({ 
        errorKey: "checkout_after_checkin" as const
      }, { status: 400 });
    }
  }

  // Auto-generate title based on listing type and event
  const listingTypeText = 
    listingType === "room" ? "Rooms" :
    listingType === "bib" ? "Race Entry" :
    "Package";

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
          return data({ errorKey: "failed_create_hotel" as const }, { status: 400 });
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
  const toListingMeta =
    user.user_type === "tour_operator"
      ? {
          room_types: roomTypes,
          room_type_prices: toRoomTypePrices,
          flexible_dates: flexibleDates,
          extra_night: {
            enabled: extraNightEnabled,
            price: extraNightPrice,
            price_unit: extraNightPriceUnit,
          },
          price_unit: listingType === "room" ? "by_room_type" : "per_person",
        }
      : null;

  const serializedCostNotes = toListingMeta
    ? JSON.stringify({ to_meta: toListingMeta, note: costNotes || null })
    : costNotes || null;

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
    room_type: user.user_type === "tour_operator" ? (roomTypes[0] || roomType || null) : roomType || null,
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
    cost_notes: serializedCostNotes,

    // Distance to finish line
    distance_to_finish: distanceData.distance_to_finish,
    walking_duration: distanceData.walking_duration,
    transit_duration: distanceData.transit_duration,

    listing_mode: "exchange",
    status: "pending",
    }as any)
    .select("id, short_id")
    .single<{ id: string; short_id: string | null }>();

  if (error) {
    console.error("Listing creation error:", error);
    return data({ errorKey: "failed_create_listing" as const }, { status: 400 });
  }

  return data({ success: true, listingId: getListingPublicId(listing as any) });
}

export default function NewListing() {
  const { t } = useI18n();
  const { user, events, googlePlacesApiKey } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const actionErrorField =
    actionData && "field" in actionData ? actionData.field : undefined;
  const actionErrorMessage = (() => {
    if (actionData && "errorKey" in actionData) {
      return t(`create_listing.error.${actionData.errorKey}` as any);
    }
    if (actionData && "error" in actionData) return actionData.error;
    return undefined;
  })();
  const createdActionData =
    actionData && "success" in actionData && actionData.success && "listingId" in actionData
      ? actionData
      : null;
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
  const [selectedRoomTypes, setSelectedRoomTypes] = useState<string[]>([]);
  const [roomTypePrices, setRoomTypePrices] = useState<Record<string, string>>({});
  const [flexibleDates, setFlexibleDates] = useState<boolean>(false);
  const [extraNightEnabled, setExtraNightEnabled] = useState<boolean>(false);
  const [extraNightPrice, setExtraNightPrice] = useState<string>("");
  const [extraNightPriceUnit, setExtraNightPriceUnit] = useState<"per_person" | "per_room">("per_person");

  // Keep listing type stable across browser refresh/back-forward restores.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedType = window.sessionStorage.getItem("new_listing_type");
    if (savedType === "room" || savedType === "bib" || savedType === "room_and_bib") {
      setListingType(savedType);
      return;
    }

    const checkedInput = document.querySelector<HTMLInputElement>('input[name="listingType"]:checked');
    const checkedValue = checkedInput?.value;
    if (checkedValue === "room" || checkedValue === "bib" || checkedValue === "room_and_bib") {
      setListingType(checkedValue);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem("new_listing_type", listingType);
  }, [listingType]);

  // Show success modal when listing is created
  useEffect(() => {
    if (createdActionData?.listingId) {
      setCreatedListingId(createdActionData.listingId);
      setShowSuccessModal(true);
    }
  }, [createdActionData]);

  // Custom validation message
useEffect(() => {
  const textarea = document.getElementById("description") as HTMLTextAreaElement;
  if (textarea && roomType === "other") {
    textarea.setCustomValidity(textarea.value ? "" : t("edit_listing.required_one_word"));
    const handleInput = () => {
      textarea.setCustomValidity(textarea.value ? "" : t("edit_listing.required_one_word"));
    };
    textarea.addEventListener("input", handleInput);
    return () => textarea.removeEventListener("input", handleInput);
  }
}, [roomType, t]);

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

  const pageBody = (
    <>
      {/* Container con immagine di sfondo ai lati */}
      <div
        className="min-h-screen bg-cover bg-center bg-no-repeat bg-fixed"
        style={{ backgroundImage: "url('/new-listing.jpg')" }}
      >
        <main className="mx-auto max-w-2xl px-4 py-8 pb-8 md:pb-8 sm:px-6 lg:px-8">
          <div className="mb-6 md:mb-8 rounded-xl bg-white/70 backdrop-blur-sm p-3 md:p-4 inline-block shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
            <h1 className="font-display text-xl md:text-3xl font-bold text-gray-900">
              {t("create_listing.title")}
            </h1>
            <p className="mt-1 md:mt-2 text-sm md:text-base text-gray-600">
              {t("create_listing.subtitle")}
            </p>
          </div>

          <div className="rounded-2xl bg-white/90 backdrop-blur-sm p-6 sm:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
          <Form method="post" className="space-y-8" onSubmit={() => setFormSubmitted(true)}>
            {/* Listing Type */}
            <div>
              <label className="label">{t("edit_listing.what_offering")}</label>
              <div className="mt-2 grid grid-cols-3 gap-3">
                <label className="relative flex cursor-pointer rounded-lg bg-white p-4 shadow-sm focus:outline-none transition-all hover:ring-2 hover:ring-blue-300 has-[:checked]:bg-blue-100 has-[:checked]:ring-2 has-[:checked]:ring-blue-500">
                  <input
                    type="radio"
                    name="listingType"
                    value="room"
                    className="sr-only"
                    checked={listingType === "room"}
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
                      {t("edit_listing.room_only")}
                    </span>
                  </span>
                </label>
                <label className="relative flex cursor-pointer rounded-lg bg-white p-4 shadow-sm focus:outline-none transition-all hover:ring-2 hover:ring-purple-300 has-[:checked]:bg-purple-100 has-[:checked]:ring-2 has-[:checked]:ring-purple-500">
                  <input
                    type="radio"
                    name="listingType"
                    value="bib"
                    className="sr-only"
                    checked={listingType === "bib"}
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
                      {t("edit_listing.bib_only")}
                    </span>
                  </span>
                </label>
                <label className="relative flex cursor-pointer rounded-lg bg-white p-4 shadow-sm focus:outline-none transition-all hover:ring-2 hover:ring-green-300 has-[:checked]:bg-green-100 has-[:checked]:ring-2 has-[:checked]:ring-green-500">
                  <input
                    type="radio"
                    name="listingType"
                    value="room_and_bib"
                    className="sr-only"
                    checked={listingType === "room_and_bib"}
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
                      {t("edit_listing.room_plus_bib")}
                    </span>
                  </span>
                </label>
              </div>
            </div>



            {/* Event Selection with Modal */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">
                {t("edit_listing.running_event")}
              </h3>
              <EventPicker
                events={events as any}
                onSelectEvent={(eventId: string) => {
                  const event = events.find((e: any) => e.id === eventId);
                  setSelectedEvent(event);
                }}
                hasError={actionErrorField === "event"}
              />
            </div>

            {/* Room Details */}
            {(listingType === "room" || listingType === "room_and_bib") && (
            <div className="space-y-4" id="roomFields">
              <h3 className="font-medium text-gray-900 border-b pb-2">
                {t("edit_listing.room_details")}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                  <label className="label">{t("edit_listing.hotel")}</label>
                                   <HotelAutocomplete
                    apiKey={googlePlacesApiKey}
                    eventCity={selectedEvent?.country}
                    eventCountry={selectedEvent?.country}
                    onSelectHotel={(hotel) => {
                      // Hotel data is handled via hidden inputs in component
                    }}
                    hasError={actionErrorField === "hotel"}
                  />

                </div>
<div> </div>
  <div> </div>              
                <div>
                <label htmlFor="roomCount" className="label mb-3">
                   {t("edit_listing.number_rooms")}
                  {maxRooms !== null && user.user_type === "tour_operator" && (
                  <span className="text-xs text-gray-500 ml-2">({t("edit_listing.max_for_account")} {maxRooms})</span>
                  )}
                  </label>
                  {user.user_type === "private" ? (
                  <>
                   <div className="flex items-center gap-3 mt-2">
                   <div className={`flex h-12 w-12 items-center justify-center rounded-lg font-bold text-2xl shadow-[0_2px_8px_rgba(0,0,0,0.15)] ${listingType === "room" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                    1
                    </div>
                    <span className="text-sm text-gray-600">{t("edit_listing.private_room_limit")}</span>
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
                    placeholder={t("edit_listing.example_two")}
                   className="input"
                  />
                   )}
                </div>

                {user.user_type === "tour_operator" ? (
                  <div className="sm:col-span-2">
                    <label className="label mb-3">{t("edit_listing.room_type")}</label>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        Select one or more room types <span className="font-medium text-red-500">• Price required</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedRoomTypes.length === TO_ROOM_TYPES.length) {
                            setSelectedRoomTypes([]);
                          } else {
                            setSelectedRoomTypes([...TO_ROOM_TYPES]);
                          }
                        }}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        {selectedRoomTypes.length === TO_ROOM_TYPES.length ? "Clear all" : "Select all"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-white p-3">
                      {TO_ROOM_TYPES.map((type) => {
                        const checked = selectedRoomTypes.includes(type);
                        return (
                          <div
                            key={type}
                            className="rounded-md border border-gray-200 bg-gray-50 px-2 py-2 text-sm text-gray-700"
                          >
                            <label className="flex min-h-[44px] items-start gap-2">
                              <input
                                type="checkbox"
                                name="roomTypes"
                                value={type}
                                checked={checked}
                                onChange={(e) => {
                                  const isChecked = e.target.checked;
                                  setSelectedRoomTypes((prev) =>
                                    isChecked ? Array.from(new Set([...prev, type])) : prev.filter((item) => item !== type)
                                  );
                                  if (!isChecked) {
                                    setRoomTypePrices((prev) => {
                                      const next = { ...prev };
                                      delete next[type];
                                      return next;
                                    });
                                  }
                                }}
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                              />
                              <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                                {type === "double_single_use" ? (
                                  <span className="leading-tight">
                                    <span>Double</span>
                                    <br />
                                    <span className="whitespace-nowrap text-xs">(Single use)</span>
                                  </span>
                                ) : (
                                  <span className="pt-0.5">{t(`edit_listing.room_type_option.${type}` as any)}</span>
                                )}

                                {checked && (
                                  <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                                    <input
                                      type="number"
                                      name={`roomPrice_${type}`}
                                      min="0"
                                      step="0.01"
                                      required
                                      value={roomTypePrices[type] || ""}
                                      onChange={(e) =>
                                        setRoomTypePrices((prev) => ({
                                          ...prev,
                                          [type]: e.target.value,
                                        }))
                                      }
                                      className="input w-16 shrink-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    />
                                    <span className="w-10 text-sm text-gray-500">{currency}</span>
                                  </div>
                                )}
                              </div>
                            </label>
                          </div>
                        );
                      })}
                    </div>

                    <input type="hidden" name="roomType" value={selectedRoomTypes[0] || ""} />
                  </div>
                ) : (
                  <RoomTypeDropdown
                    value={roomType}
                    onChange={setRoomType}
                    hasError={actionErrorField === "roomType"}
                  />
                )}

                <div className="mt-4">
                  <label htmlFor="checkIn" className="label mb-3">
                    Check-in
                  </label>
                  <DatePicker
                    id="checkIn"
                    name="checkIn"
                    placeholder={t("edit_listing.date_placeholder")}
                    minDate={dateConstraints.min ? new Date(dateConstraints.min) : undefined}
                    maxDate={dateConstraints.max ? new Date(dateConstraints.max) : undefined}
                    onChange={(date) => setCheckInDate(date)}
                  />
                  {selectedEvent && (
                    <p className="mt-1 text-xs text-gray-500">
                      {t("edit_listing.event_date")}: {new Date(selectedEvent.event_date).toLocaleDateString()} (±7 {t("edit_listing.days")})
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
                    placeholder={t("edit_listing.date_placeholder")}
                    minDate={checkInDate || (dateConstraints.min ? new Date(dateConstraints.min) : undefined)}
                    maxDate={dateConstraints.max ? new Date(dateConstraints.max) : undefined}
                  />
                </div>

                {user.user_type === "tour_operator" && (
                  <div className="sm:col-span-2 space-y-3">
                    <div className="rounded-lg border border-gray-200 bg-slate-50 p-3">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                          type="checkbox"
                          name="flexibleDates"
                          checked={flexibleDates}
                          onChange={(e) => setFlexibleDates(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                        Flexible dates
                      </label>
                      <p className="mt-1 text-xs text-gray-500">Base dates are fixed, but users can request changes.</p>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-slate-50 p-4">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                          type="checkbox"
                          name="extraNightEnabled"
                          checked={extraNightEnabled}
                          onChange={(e) => setExtraNightEnabled(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                        Extra night available
                      </label>

                      {extraNightEnabled && (
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <input
                            type="number"
                            name="extraNightPrice"
                            min="0"
                            step="0.01"
                            value={extraNightPrice}
                            onChange={(e) => setExtraNightPrice(e.target.value)}
                            className="input w-20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            placeholder="Required"
                            required
                          />
                          <select
                            name="extraNightPriceUnit"
                            value={extraNightPriceUnit}
                            onChange={(e) => setExtraNightPriceUnit(e.target.value === "per_room" ? "per_room" : "per_person")}
                            className="input w-44"
                          >
                            <option value="per_person">Per person</option>
                            <option value="per_room">Per room</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}
            {/* Bib Details */}
            {(listingType === "bib" || listingType === "room_and_bib") && (
<div className="space-y-4" id="bibFields">
  <h3 className="font-medium text-gray-900 border-b pb-2">
    {t("edit_listing.bib_transfer_details")}
  </h3>
  
  {/* Disclaimer - solo per utenti privati */}
  {user.user_type === "private" && (
    <div className={`rounded-lg p-4 ${listingType === "bib" ? "bg-purple-50 border border-purple-200" : "bg-green-50 border border-green-200"}`}>
      <p className={`text-sm ${listingType === "bib" ? "text-purple-800" : "text-green-800"}`}>
        <strong>{t("edit_listing.important")}:</strong> {t("edit_listing.private_bib_notice")}
      </p>
    </div>
  )}
  
  <div className={(user.user_type === "private") ? "mt-6" : ""}>
  <label htmlFor="bibCount" className="label">
    {t("edit_listing.number_bibs")}
    {maxBibs !== null && user.user_type === "tour_operator" && (
      <span className="text-xs text-gray-500 ml-2">({t("edit_listing.max_for_account")} {maxBibs})</span>
    )}
  </label>
  {user.user_type === "private" ? (
    <>
      <div className="flex items-center gap-3 mt-2">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg font-bold text-2xl shadow-[0_2px_8px_rgba(0,0,0,0.15)] ${listingType === "bib" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}>
          1
        </div>
        <span className="text-sm text-gray-600">{t("edit_listing.private_bib_limit")}</span>
      </div>
      <input type="hidden" name="bibCount" value="1" />
    </>
  ) : (
    <input
      type="text"
      id="bibCount"
      name="bibCount"
      inputMode="numeric"
      pattern="[0-9]*"
      placeholder={t("edit_listing.example_one")}
      className="input w-full sm:w-48"
      onInput={(e) => {
        const target = e.currentTarget;
        target.value = target.value.replace(/\D+/g, "");
      }}
    />
  )}
</div>

  
    <div>
    <label htmlFor="transferType" className="label">
      {t("edit_listing.transfer_method")} <span className="text-red-500">*</span>
    </label>
    {user.user_type === "private" ? (
      <>
        <div className="mt-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
          {t("edit_listing.official_transfer")}
        </div>
        <input type="hidden" name="transferType" value="official_process" />
      </>
    ) : (
      <>
        <TransferMethodDropdown
          value={transferMethod || ""}
          onChange={(value) => setTransferMethod(value as TransferMethod)}
          options={transferMethodOptions}
          placeholder={t("edit_listing.select_transfer_method")}
        />
      </>
    )}
  </div>


  {/* Associated costs - show based on transfer method and listing type */}
  {visibleFields.showAssociatedCosts && (
    <div>
      <label htmlFor="associatedCosts" className="label">
        {t("create_listing.associated_costs")} <span className="text-gray-400">{t("edit_listing.optional")}</span>
      </label>
      <input
        type="number"
        id="associatedCosts"
        name="associatedCosts"
        min="0"
        step="0.01"
        placeholder={t("create_listing.example_fifty")}
        className="input [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <p className="mt-1 text-xs text-gray-500">
        {t("create_listing.associated_costs_help")}
      </p>
    </div>
  )}

  {/* Package info - show when "package" is selected */}
  {visibleFields.showPackageInfo && (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <p className="text-sm text-green-800">
        <strong>{t("edit_listing.package_transfer")}:</strong> {t("edit_listing.package_transfer_help")}
      </p>
    </div>
  )}

</div>
            )}
            {/* Price - nascondi per privati con bib only */}
            {!(user.user_type === "private" && listingType === "bib") && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="price" className="label mb-3 text-sm md:text-base font-semibold">
                    {t("edit_listing.amount")}
                  </label>
                  {user.user_type === "tour_operator" && (
                    <p className="mb-2 text-xs text-gray-500">*Required</p>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="number"
                      id="price"
                      name="price"
                      min="0"
                      step="0.01"
                      placeholder=""
                      className="input w-24 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={priceValue}
                      required={user.user_type === "tour_operator"}
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
                  {user.user_type !== "tour_operator" && (
                    <p className="mt-1.5 text-sm text-gray-500">
                      {t("edit_listing.empty_contact_price")}
                    </p>
                  )}
                </div>

                {/* Price negotiable - appare solo quando c'è un prezzo */}
                {priceValue && (listingType === "room" || listingType === "room_and_bib") && (
                  <div className="mt-4">
                    <input type="hidden" name="priceNegotiable" value={priceNegotiable === true ? "true" : "false"} />
                    <span className="text-sm text-gray-700">{t("edit_listing.price_negotiable")}</span>
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
                        {t("edit_listing.yes")}
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
                        {t("edit_listing.no")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <label htmlFor="description" className="label">
  {user.user_type === "private" && listingType === "bib" ? t("edit_listing.notes") : t("edit_listing.additional_details")}{" "}
  <span className={roomType === "other" ? "text-red-500" : "text-gray-400"}>
    {roomType === "other" ? t("edit_listing.required") : t("edit_listing.optional")}
  </span>
</label>
             <textarea
  id="description"
  name="description"
  rows={4}
  placeholder={t("edit_listing.additional_placeholder")}
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
            <div className="flex gap-4 pt-4">
              <button type="submit" className="btn-primary flex-1 rounded-full">
                {t("create_listing.submit")}
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
                {t("create_listing.success_title")}
              </h2>

              {/* Message */}
              <p className="text-gray-600 mb-8">
                {t("create_listing.success_body")}
              </p>

              {/* Buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => navigate(`/listings/${createdListingId}`)}
                  className="btn-primary w-full py-3 rounded-full"
                >
                  {t("create_listing.view_listing")}
                </button>
                {user.user_type === "tour_operator" && (
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      navigate("/to-panel");
                    }}
                    className="btn bg-gray-100 text-gray-700 hover:bg-gray-200 w-full py-3 rounded-full"
                  >
                    {t("create_listing.go_dashboard")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (user.user_type === "tour_operator") {
    return (
      <ControlPanelLayout
        panelLabel={t("dashboard.panel_label")}
        mobileTitle={t("dashboard.mobile_title")}
        homeTo="/to-panel"
        user={{
          fullName: user.full_name,
          email: user.email,
          roleLabel: t("dashboard.role_tour_operator"),
          avatarUrl: user.avatar_url,
        }}
        navItems={tourOperatorNavItems}
      >
        <div className="-m-4 min-h-full md:-m-8">{pageBody}</div>
      </ControlPanelLayout>
    );
  }

  return (
    <div className="min-h-full">
      <Header user={user} />
      {pageBody}
    </div>
  );
}
