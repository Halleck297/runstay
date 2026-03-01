import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, useActionData, useLoaderData, Link, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { useI18n } from "~/hooks/useI18n";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { applyListingPublicIdFilter, getListingPublicId } from "~/lib/publicIds";
import { Header } from "~/components/Header";
import { EventPicker } from "~/components/EventPicker";
import { HotelAutocomplete } from "~/components/HotelAutocomplete";
import { DatePicker } from "~/components/DatePicker";
import { RoomTypeDropdown } from "~/components/RoomTypeDropdown";
import { CurrencyPicker } from "~/components/CurrencyPicker";
import { getCurrencyForCountry, normalizeCurrencyOrDefault } from "~/lib/currency";
import { buildConvertedPriceMap, getLatestFxRates } from "~/lib/fx.server";
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
  const listingQuery = supabaseAdmin
    .from("listings")
    .select(`
      *,
      event:events(id, name, country, event_date)
    `);
  const { data: listing, error } = await applyListingPublicIdFilter(listingQuery as any, id!).single();

  if (error || !listing) {
    throw new Response("Listing not found", { status: 404 });
  }

  // Check ownership
  if ((listing as any).author_id !== (user as any).id) {
    throw new Response("Unauthorized", { status: 403 });
  }

  // Get existing events for autocomplete
  const { data: events } = await supabaseAdmin
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
  const existingListingQuery = supabaseAdmin
    .from("listings")
    .select("id, short_id, author_id");
  const { data: existingListing } = await applyListingPublicIdFilter(existingListingQuery as any, id!).single();

  if (!existingListing || (existingListing as any).author_id !== (user as any).id) {
    return data({ errorKey: "unauthorized" }, { status: 403 });
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
  const currency = normalizeCurrencyOrDefault(
    formData.get("currency") as string | null,
    user.country
  );
  const priceNegotiable = formData.get("priceNegotiable") === "true";
  const numericPrice = price ? parseFloat(price) : null;
  const numericAssociatedCosts = associatedCosts ? parseFloat(associatedCosts) : null;
  const fxRates = await getLatestFxRates();
  const priceConverted = buildConvertedPriceMap(numericPrice, currency, fxRates);
  const associatedCostsConverted = buildConvertedPriceMap(numericAssociatedCosts, currency, fxRates);

  // Validation
  if (!listingType) {
    return data({ errorKey: "select_listing_type" }, { status: 400 });
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
    const { data: newEvent, error: eventError } = await supabaseAdmin
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
      return data({ errorKey: "failed_create_event" }, { status: 400 });
    }

    finalEventId = newEvent.id;
  }

  if (!finalEventId) {
    return data({ errorKey: "select_or_create_event" }, { status: 400 });
  }

  // Get event details for title
  const { data: eventData } = await supabaseAdmin
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
      return data({ errorKey: "checkin_window" }, { status: 400 });
    }

    if (checkOutDate < minDate || checkOutDate > maxDate) {
      return data({ errorKey: "checkout_window" }, { status: 400 });
    }

    if (checkOutDate <= checkInDate) {
      return data({ errorKey: "checkout_after_checkin" }, { status: 400 });
    }
  }

  // Auto-generate title
  const listingTypeText =
    listingType === "room" ? "Rooms" :
    listingType === "bib" ? "Race Entry" :
    "Package";

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
          return data({ errorKey: "failed_create_hotel" }, { status: 400 });
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
      price: numericPrice,
      currency,
      price_converted: priceConverted,
      price_negotiable: priceNegotiable,

      // Bib transfer
      transfer_type: transferType || null,
      associated_costs: numericAssociatedCosts,
      associated_costs_converted: associatedCostsConverted,
      cost_notes: costNotes || null,
    } as any)
    .eq("id", (existingListing as any).id);

  if (error) {
    console.error("Listing update error:", error);
    return data({ errorKey: "failed_update_listing" }, { status: 400 });
  }

  return redirect(`/listings/${getListingPublicId(existingListing as any)}`);
}

export default function EditListing() {
  const { user, listing, events, googlePlacesApiKey } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const actionErrorField =
    actionData && "field" in actionData ? actionData.field : undefined;
  const actionErrorMessage =
    actionData && "error" in actionData ? actionData.error : undefined;
  const actionErrorKey =
    actionData && "errorKey" in actionData ? actionData.errorKey : undefined;
  const navigate = useNavigate();
  const { t } = useI18n();
  const resolvedActionErrorMessage = actionErrorKey
    ? {
        unauthorized: t("edit_listing.error.unauthorized"),
        select_listing_type: t("edit_listing.error.select_listing_type"),
        failed_create_event: t("edit_listing.error.failed_create_event"),
        select_or_create_event: t("edit_listing.error.select_or_create_event"),
        checkin_window: t("edit_listing.error.checkin_window"),
        checkout_window: t("edit_listing.error.checkout_window"),
        checkout_after_checkin: t("edit_listing.error.checkout_after_checkin"),
        failed_create_hotel: t("edit_listing.error.failed_create_hotel"),
        failed_update_listing: t("edit_listing.error.failed_update_listing"),
      }[actionErrorKey as string]
    : actionErrorMessage;

  const listingData = listing as any;

  const [listingType, setListingType] = useState<"room" | "bib" | "room_and_bib">(listingData.listing_type);
  const [roomType, setRoomType] = useState<string>(listingData.room_type || "");
  const [selectedEvent, setSelectedEvent] = useState<any>(listingData.event);
  const [transferMethod, setTransferMethod] = useState<TransferMethod | null>(listingData.transfer_type);
  const [checkInDate, setCheckInDate] = useState<Date | null>(listingData.check_in ? new Date(listingData.check_in) : null);
  const [currency, setCurrency] = useState<string>(listingData.currency || getCurrencyForCountry((user as any).country));
  const [priceValue, setPriceValue] = useState<string>(listingData.price?.toString() || "");
  const [priceNegotiable, setPriceNegotiable] = useState<boolean | null>(listingData.price_negotiable === true ? true : listingData.price_negotiable === false ? false : null);

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
    <div className="min-h-full bg-[#ECF4FE]">
      <Header user={user} />

      {/* Container con immagine di sfondo ai lati */}
      <div
        className="min-h-screen bg-cover bg-center bg-no-repeat bg-fixed"
        style={{ backgroundImage: "url('/new-listing.jpg')" }}
      >
        <main className="mx-auto max-w-2xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8">
          <div className="mb-8 rounded-xl bg-white/70 backdrop-blur-sm p-4 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
            <Link
              to={`/listings/${getListingPublicId(listingData)}`}
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 underline"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t("listings.back_to_listings")}
            </Link>
            <h1 className="font-display text-3xl font-bold text-gray-900">
              {t("listings.edit_listing")}
            </h1>
            <p className="mt-2 text-gray-600">
              {t("edit_listing.subtitle")}
            </p>
          </div>

          <div className="rounded-2xl bg-white/90 backdrop-blur-sm p-6 sm:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
          <Form method="post" className="space-y-8">
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
                    defaultChecked={listingType === "room"}
                    onChange={(e) => setListingType(e.target.value as "room")}
                  />
                  <span className="flex flex-1 flex-col items-center text-center">
                    <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className="mt-2 text-sm font-medium text-gray-900">{t("edit_listing.room_only")}</span>
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
                    <span className="mt-2 text-sm font-medium text-gray-900">{t("edit_listing.bib_only")}</span>
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
                    <span className="mt-2 text-sm font-medium text-gray-900">{t("edit_listing.room_plus_bib")}</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Event Selection */}
            <div>
              <label className="label">{t("edit_listing.running_event")}</label>
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
                <h3 className="font-medium text-gray-900 border-b pb-2">{t("edit_listing.room_details")}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="label">{t("edit_listing.hotel")}</label>
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
                      {t("edit_listing.number_rooms")}
                      {maxRooms !== null && (user as any).user_type === "tour_operator" && (
                        <span className="text-xs text-gray-500 ml-2">({t("edit_listing.max_for_account")} {maxRooms})</span>
                      )}
                    </label>
                    {(user as any).user_type === "private" ? (
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
                        defaultValue={listingData.room_count || ""}
                        placeholder={t("edit_listing.example_two")}
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
                    <label htmlFor="checkIn" className="label mb-3">{t("edit_listing.check_in")}</label>
                    <DatePicker
                      id="checkIn"
                      name="checkIn"
                      placeholder={t("edit_listing.date_placeholder")}
                      defaultValue={listingData.check_in || undefined}
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
                    <label htmlFor="checkOut" className="label mb-3">{t("edit_listing.check_out")}</label>
                    <DatePicker
                      id="checkOut"
                      name="checkOut"
                      placeholder={t("edit_listing.date_placeholder")}
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
                <h3 className="font-medium text-gray-900 border-b pb-2">{t("edit_listing.bib_transfer_details")}</h3>

                {(user as any).user_type === "private" && (
                  <div className={`rounded-lg p-4 ${listingType === "bib" ? "bg-purple-50 border border-purple-200" : "bg-green-50 border border-green-200"}`}>
                    <p className={`text-sm ${listingType === "bib" ? "text-purple-800" : "text-green-800"}`}>
                      <strong>{t("edit_listing.important")}:</strong> {t("edit_listing.private_bib_notice")}
                    </p>
                  </div>
                )}

                <div className={(user as any).user_type === "private" ? "mt-6" : ""}>
                  <label htmlFor="bibCount" className="label">
                    {t("edit_listing.number_bibs")}
                    {maxBibs !== null && (user as any).user_type === "tour_operator" && (
                        <span className="text-xs text-gray-500 ml-2">({t("edit_listing.max_for_account")} {maxBibs})</span>
                    )}
                  </label>
                  {(user as any).user_type === "private" ? (
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
                      type="number"
                      id="bibCount"
                      name="bibCount"
                      min="1"
                      max={maxBibs || undefined}
                      defaultValue={listingData.bib_count || ""}
                      placeholder={t("edit_listing.example_one")}
                      className="input w-full sm:w-48"
                    />
                  )}
                </div>

                <div>
                  <label htmlFor="transferType" className="label">
                    {t("edit_listing.transfer_method")} <span className="text-red-500">*</span>
                  </label>
                  {(user as any).user_type === "private" ? (
                    <>
                      <div className="mt-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                        {t("edit_listing.official_transfer")}
                      </div>
                      <input type="hidden" name="transferType" value="official_process" />
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
                        <option value="">{t("edit_listing.select_transfer_method")}</option>
                        {transferMethodOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>

                {visibleFields.showPackageInfo && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800">
                      <strong>{t("edit_listing.package_transfer")}:</strong> {t("edit_listing.package_transfer_help")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Price */}
            {!((user as any).user_type === "private" && listingType === "bib") && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="price" className="label mb-3 text-sm md:text-base font-semibold">{t("edit_listing.amount")}</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      id="price"
                      name="price"
                      min="0"
                      step="0.01"
                      placeholder={t("edit_listing.empty_contact_price")}
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
                {(user as any).user_type === "private" && listingType === "bib" ? t("edit_listing.notes") : t("edit_listing.additional_details")}{" "}
                <span className={roomType === "other" ? "text-red-500" : "text-gray-400"}>
                  {roomType === "other" ? t("edit_listing.required") : t("edit_listing.optional")}
                </span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={listingData.description || ""}
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
                {resolvedActionErrorMessage}
              </div>
            )}

            {/* Submit */}
            <div className="pt-4">
              <button type="submit" className="btn-primary w-full rounded-full">
                {t("profile.actions.save_changes")}
              </button>
            </div>
          </Form>
          </div>
        </main>
      </div>
    </div>
  );
}
