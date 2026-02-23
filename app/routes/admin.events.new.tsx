import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { requireAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { applyListingPublicIdFilter, getListingPublicId } from "~/lib/publicIds";
import { EventPicker } from "~/components/EventPicker";
import { HotelAutocomplete } from "~/components/HotelAutocomplete";
import { DatePicker } from "~/components/DatePicker";
import { RoomTypeDropdown } from "~/components/RoomTypeDropdown";
import { CurrencyPicker } from "~/components/CurrencyPicker";
import { calculateDistanceData } from "~/lib/distance.server";

export const meta: MetaFunction = () => [{ title: "Create Event Listing - Admin - Runoot" }];

type SourceRequest = {
  id: string;
  team_leader_id: string;
  event_name: string;
  event_location: string;
  event_date: string;
  request_type: "bib" | "hotel" | "package";
  people_count: number;
  public_note: string | null;
  notes: string | null;
  quote_summary: string | null;
  selected_agency_name: string | null;
  event_image_url: string | null;
};

type SourceListing = {
  id: string;
  short_id: string | null;
  event_id: string;
  listing_type: "room" | "bib" | "room_and_bib";
  description: string | null;
  hotel_name: string | null;
  hotel_website: string | null;
  room_count: number | null;
  room_type: string | null;
  check_in: string | null;
  check_out: string | null;
  bib_count: number | null;
  price: number | null;
  currency: string | null;
  price_negotiable: boolean | null;
  transfer_type: string | null;
  associated_costs: number | null;
  status: string | null;
  event: {
    id: string;
    name: string;
    country: string;
    location: string | null;
    event_date: string;
  } | null;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const admin = await requireAdmin(request);
  const url = new URL(request.url);
  const requestId = url.searchParams.get("requestId");
  const listingId = url.searchParams.get("listingId");

  const { data: events } = await supabaseAdmin
    .from("events")
    .select("id, name, country, location, event_date")
    .order("event_date", { ascending: true });

  let sourceRequest: SourceRequest | null = null;
  if (requestId) {
    const { data: req } = await (supabaseAdmin.from("event_requests") as any)
      .select(
        "id, team_leader_id, event_name, event_location, event_date, request_type, people_count, public_note, notes, quote_summary, selected_agency_name, event_image_url"
      )
      .eq("id", requestId)
      .maybeSingle();

    if (req) sourceRequest = req as SourceRequest;
  }

  let sourceListing: SourceListing | null = null;
  if (listingId) {
    const listingQuery = supabaseAdmin
      .from("listings")
      .select(
        "id, short_id, event_id, listing_type, description, hotel_name, hotel_website, room_count, room_type, check_in, check_out, bib_count, price, currency, price_negotiable, transfer_type, associated_costs, status, event:events(id, name, country, location, event_date)"
      );
    const { data: listing } = await applyListingPublicIdFilter(listingQuery as any, listingId).maybeSingle();
    sourceListing = (listing as SourceListing | null) || null;
  }

  if (!sourceRequest && sourceListing) {
    const listingPublicId = getListingPublicId(sourceListing as any);
    const { data: req } = await (supabaseAdmin.from("event_requests") as any)
      .select(
        "id, team_leader_id, event_name, event_location, event_date, request_type, people_count, public_note, notes, quote_summary, selected_agency_name, event_image_url"
      )
      .ilike("published_listing_url", `%/listings/${listingPublicId}`)
      .maybeSingle();
    sourceRequest = (req as SourceRequest | null) || null;
  }

  return {
    admin,
    events: events || [],
    sourceRequest,
    sourceListing,
    googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || "",
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();

  const sourceRequestId = String(formData.get("sourceRequestId") || "").trim();
  const editListingId = String(formData.get("editListingId") || "").trim();
  const rawListingType = String(formData.get("listingType") || "").trim();
  const listingType = (rawListingType === "room" || rawListingType === "bib" || rawListingType === "room_and_bib"
    ? rawListingType
    : "room") as "room" | "bib" | "room_and_bib";
  const description = String(formData.get("description") || "").trim();

  const eventId = String(formData.get("eventId") || "").trim();
  const newEventName = String(formData.get("newEventName") || "").trim();
  const newEventCountry = String(formData.get("newEventCountry") || "").trim();
  const newEventLocation = String(formData.get("newEventLocation") || "").trim();
  const newEventDate = String(formData.get("newEventDate") || "").trim();

  const hotelPlaceId = String(formData.get("hotelPlaceId") || "").trim();
  const hotelName = String(formData.get("hotelName") || "").trim();
  const hotelWebsite = String(formData.get("hotelWebsite") || "").trim();
  const hotelCity = String(formData.get("hotelCity") || "").trim();
  const hotelCountry = String(formData.get("hotelCountry") || "").trim();
  const hotelLat = String(formData.get("hotelLat") || "").trim();
  const hotelLng = String(formData.get("hotelLng") || "").trim();
  const hotelRating = String(formData.get("hotelRating") || "").trim();

  const roomCount = String(formData.get("roomCount") || "").trim();
  const roomType = String(formData.get("roomType") || "").trim();
  const checkIn = String(formData.get("checkIn") || "").trim();
  const checkOut = String(formData.get("checkOut") || "").trim();

  const bibCount = String(formData.get("bibCount") || "").trim();
  const transferType = String(formData.get("transferType") || "").trim();
  const associatedCosts = String(formData.get("associatedCosts") || "").trim();

  const price = String(formData.get("price") || "").trim();
  const currency = String(formData.get("currency") || "EUR").trim().toUpperCase() || "EUR";
  const priceNegotiable = formData.get("priceNegotiable") === "true";

  let sourceRequest: SourceRequest | null = null;
  if (sourceRequestId) {
    const { data: req } = await (supabaseAdmin.from("event_requests") as any)
      .select(
        "id, team_leader_id, event_name, event_location, event_date, request_type, people_count, public_note, notes, quote_summary, selected_agency_name, event_image_url"
      )
      .eq("id", sourceRequestId)
      .maybeSingle();
    sourceRequest = (req as SourceRequest | null) || null;
  }

  let existingListing: any = null;
  if (editListingId) {
    const { data: row } = await supabaseAdmin
      .from("listings")
      .select("id, author_id, event_id, status")
      .eq("id", editListingId)
      .maybeSingle();
    existingListing = row || null;
    if (!existingListing) {
      return data({ error: "Listing to edit was not found." }, { status: 404 });
    }
  }

  let finalEventId = eventId || existingListing?.event_id || "";
  let createdEventId: string | null = null;

  if (!finalEventId) {
    const eventName = newEventName || sourceRequest?.event_name || "Untitled Event";
    const eventCountry = newEventCountry || sourceRequest?.event_location || "TBD";
    const eventLocation = newEventLocation || sourceRequest?.event_location || null;
    const eventDate = newEventDate || sourceRequest?.event_date || new Date().toISOString().slice(0, 10);

    const { data: newEvent, error: newEventError } = await supabaseAdmin
      .from("events")
      .insert({
        name: eventName,
        country: eventCountry,
        location: eventLocation,
        event_date: eventDate,
        card_image_url: sourceRequest?.event_image_url || null,
        created_by: (admin as any).id,
      } as any)
      .select("id")
      .single<{ id: string }>();

    if (newEventError || !newEvent) {
      return data({ error: `Failed to create event: ${newEventError?.message || "unknown"}` }, { status: 400 });
    }

    finalEventId = newEvent.id;
    createdEventId = newEvent.id;
  }

  const { data: eventData } = await supabaseAdmin
    .from("events")
    .select("id, name, event_date, finish_lat, finish_lng")
    .eq("id", finalEventId)
    .single<{ id: string; name: string; event_date: string; finish_lat: number | null; finish_lng: number | null }>();

  if (!eventData) {
    return data({ error: "Event not found." }, { status: 404 });
  }

  if ((listingType === "room" || listingType === "room_and_bib") && checkIn && checkOut) {
    const eventDate = new Date(eventData.event_date);
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    const minDate = new Date(eventDate);
    minDate.setDate(minDate.getDate() - 10);
    const maxDate = new Date(eventDate);
    maxDate.setDate(maxDate.getDate() + 10);

    if (checkInDate < minDate || checkInDate > maxDate) {
      return data({ error: "Check-in must be within +/-10 days from event date." }, { status: 400 });
    }
    if (checkOutDate < minDate || checkOutDate > maxDate) {
      return data({ error: "Check-out must be within +/-10 days from event date." }, { status: 400 });
    }
    if (checkOutDate <= checkInDate) {
      return data({ error: "Check-out must be after check-in." }, { status: 400 });
    }
  }

  const listingTypeText = listingType === "room" ? "Hotel" : listingType === "bib" ? "Bibs" : "Package";
  const autoTitle = `${listingTypeText} for ${eventData.name}`;

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
            city: hotelCity || null,
            country: hotelCountry || null,
            website: hotelWebsite || null,
            lat: hotelLat ? parseFloat(hotelLat) : null,
            lng: hotelLng ? parseFloat(hotelLng) : null,
            rating: hotelRating ? parseFloat(hotelRating) : null,
          } as any)
          .select("id")
          .single();

        if (hotelError || !newHotel) {
          return data({ error: `Failed to create hotel: ${hotelError?.message || "unknown"}` }, { status: 400 });
        }
        finalHotelId = (newHotel as any).id;
      }
    }
  }

  const distanceData = await calculateDistanceData(
    hotelLat ? parseFloat(hotelLat) : null,
    hotelLng ? parseFloat(hotelLng) : null,
    eventData.finish_lat ?? null,
    eventData.finish_lng ?? null,
    eventData.event_date
  );

  const baseListingPatch: Record<string, any> = {
    event_id: finalEventId,
    listing_type: listingType,
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
    room_count: roomCount ? parseInt(roomCount, 10) : null,
    room_type: roomType || null,
    check_in: checkIn || null,
    check_out: checkOut || null,
    bib_count: bibCount ? parseInt(bibCount, 10) : null,
    price: price ? parseFloat(price) : null,
    currency,
    price_negotiable: priceNegotiable,
    transfer_type: transferType || null,
    associated_costs: associatedCosts ? parseFloat(associatedCosts) : null,
    distance_to_finish: distanceData.distance_to_finish,
    walking_duration: distanceData.walking_duration,
    transit_duration: distanceData.transit_duration,
  };

  let listing: { id: string; short_id: string | null } | null = null;
  let listingError: any = null;

  if (existingListing) {
    const response = await supabaseAdmin
      .from("listings")
      .update({
        ...baseListingPatch,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", existingListing.id)
      .select("id, short_id")
      .single<{ id: string; short_id: string | null }>();
    listing = response.data;
    listingError = response.error;
  } else {
    const authorId = sourceRequest?.team_leader_id || (admin as any).id;
    const response = await supabaseAdmin
      .from("listings")
      .insert({
        author_id: authorId,
        ...baseListingPatch,
        status: "active",
      } as any)
      .select("id, short_id")
      .single<{ id: string; short_id: string | null }>();
    listing = response.data;
    listingError = response.error;
  }

  if (listingError || !listing) {
    return data({ error: `Failed to create listing: ${listingError?.message || "unknown"}` }, { status: 400 });
  }

  const listingPublicId = getListingPublicId(listing);
  const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  const listingUrl = `${appUrl}/listings/${listingPublicId}`;

  if (sourceRequestId) {
    await (supabaseAdmin.from("event_requests") as any)
      .update({
        published_listing_url: listingUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sourceRequestId);
  }

  return data({
    success: true,
    listingId: listingPublicId,
    listingUrl,
    sourceRequestId,
    createdEventId,
  });
}

export default function AdminCreateEventListingPage() {
  const { events, sourceRequest, sourceListing, googlePlacesApiKey } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();

  const [listingType, setListingType] = useState<"room" | "bib" | "room_and_bib">(
    sourceListing?.listing_type
      ? sourceListing.listing_type
      : sourceRequest?.request_type === "bib"
      ? "bib"
      : sourceRequest?.request_type === "hotel"
      ? "room"
      : "room_and_bib"
  );
  const [roomType, setRoomType] = useState<string>(sourceListing?.room_type || "double");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [checkInDate, setCheckInDate] = useState<Date | null>(null);
  const [currency, setCurrency] = useState<string>(sourceListing?.currency || "EUR");
  const [priceValue, setPriceValue] = useState<string>(
    sourceListing?.price !== null && sourceListing?.price !== undefined ? String(sourceListing.price) : ""
  );
  const [priceNegotiable, setPriceNegotiable] = useState<boolean>(!!sourceListing?.price_negotiable);

  useEffect(() => {
    const candidate = sourceListing?.event
      ? (events as any[]).find((e) => e.id === sourceListing.event?.id)
      : (events as any[]).find(
          (e) =>
            String(e.name || "").toLowerCase() === String(sourceRequest?.event_name || "").toLowerCase() &&
            String(e.event_date || "").slice(0, 10) === String(sourceRequest?.event_date || "").slice(0, 10)
        );
    if (candidate) {
      setSelectedEvent(candidate);
    }
  }, [events, sourceRequest, sourceListing]);

  const dateConstraints = useMemo(() => {
    if (!selectedEvent?.event_date) return { min: undefined, max: undefined };
    const eventDate = new Date(selectedEvent.event_date);
    const minDate = new Date(eventDate);
    minDate.setDate(minDate.getDate() - 7);
    const maxDate = new Date(eventDate);
    maxDate.setDate(maxDate.getDate() + 7);
    return {
      min: minDate,
      max: maxDate,
    };
  }, [selectedEvent]);

  const created = actionData && typeof actionData === "object" && "success" in actionData && actionData.success;

  return (
    <div className="min-h-full bg-slate-100">
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {sourceListing ? "Edit Event Listing" : "Create New Event Listing"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {sourceListing
                ? "Admin-only edit mode for event listing details."
                : "Admin-only form to build the final listing card from approved requests."}
            </p>
          </div>
          <Link to="/admin/event-requests" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Back to Event Requests
          </Link>
        </div>

        {sourceRequest && (
          <div className="mb-5 rounded-2xl border border-brand-200 bg-brand-50/80 p-4">
            <p className="text-sm font-semibold text-brand-800">Source Request</p>
            <p className="mt-1 text-sm text-slate-700">
              {sourceRequest.event_name} · {sourceRequest.event_location} · {new Date(sourceRequest.event_date).toLocaleDateString()} · {sourceRequest.request_type}
            </p>
            {(sourceRequest.quote_summary || sourceRequest.selected_agency_name) && (
              <p className="mt-1 text-xs text-slate-600">
                {sourceRequest.selected_agency_name ? `Agency: ${sourceRequest.selected_agency_name}` : ""}
                {sourceRequest.selected_agency_name && sourceRequest.quote_summary ? " · " : ""}
                {sourceRequest.quote_summary || ""}
              </p>
            )}
          </div>
        )}

        {actionData && typeof actionData === "object" && "error" in actionData && actionData.error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error as string}</div>
        )}

        {created && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Listing created successfully.
            {" "}
            {"listingId" in actionData && actionData.listingId ? (
              <Link className="font-semibold underline" to={`/listings/${String(actionData.listingId)}`}>
                Open listing
              </Link>
            ) : null}
            {"sourceRequestId" in actionData && actionData.sourceRequestId ? (
              <span>
                {" "}·{" "}
                <Link className="font-semibold underline" to="/admin/event-requests">
                  Continue publish/notify
                </Link>
              </span>
            ) : null}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_28px_rgba(15,23,42,0.08)]">
          <Form method="post" className="space-y-8">
            <input type="hidden" name="sourceRequestId" value={sourceRequest?.id || ""} />
            <input type="hidden" name="editListingId" value={sourceListing?.id || ""} />

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Listing Type</h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "room", label: "Hotel" },
                  { value: "bib", label: "Bibs" },
                  { value: "room_and_bib", label: "Package" },
                ].map((opt) => (
                  <label key={opt.value} className="relative flex cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                    <input
                      type="radio"
                      name="listingType"
                      value={opt.value}
                      checked={listingType === opt.value}
                      onChange={(e) => setListingType(e.target.value as "room" | "bib" | "room_and_bib")}
                      className="sr-only"
                    />
                    <span className="text-sm font-semibold text-slate-800">{opt.label}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="space-y-4 border-t border-slate-200 pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Event</h2>
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700">Link to existing event (optional)</label>
                <EventPicker
                  events={events as any}
                  defaultEventId={sourceListing?.event_id || undefined}
                  onSelectEvent={(eventId: string) => {
                    const event = (events as any[]).find((e) => e.id === eventId);
                    setSelectedEvent(event || null);
                  }}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="label">Event name</label>
                  <input
                    name="newEventName"
                    className="input"
                    defaultValue={sourceListing?.event?.name || sourceRequest?.event_name || ""}
                    placeholder="e.g. Berlin Marathon"
                  />
                </div>
                <div>
                  <label className="label">Country</label>
                  <input
                    name="newEventCountry"
                    className="input"
                    defaultValue={sourceListing?.event?.country || sourceRequest?.event_location || ""}
                    placeholder="e.g. Germany"
                  />
                </div>
                <div>
                  <label className="label">Location</label>
                  <input
                    name="newEventLocation"
                    className="input"
                    defaultValue={sourceListing?.event?.location || sourceRequest?.event_location || ""}
                    placeholder="e.g. Berlin"
                  />
                </div>
                <div>
                  <label className="label">Event date</label>
                  <DatePicker
                    name="newEventDate"
                    id="newEventDate"
                    placeholder="Select date"
                    defaultValue={sourceListing?.event?.event_date || sourceRequest?.event_date || undefined}
                  />
                </div>
              </div>
            </section>

            {(listingType === "room" || listingType === "room_and_bib") && (
              <section className="space-y-4 border-t border-slate-200 pt-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Hotel + Room</h2>

                <div>
                  <label className="label">Hotel</label>
                  <HotelAutocomplete
                    apiKey={googlePlacesApiKey}
                    eventCity={selectedEvent?.location || sourceListing?.event?.location || sourceRequest?.event_location || ""}
                    eventCountry={selectedEvent?.country || sourceListing?.event?.country || sourceRequest?.event_location || ""}
                    defaultHotelName={sourceListing?.hotel_name || undefined}
                    onSelectHotel={() => undefined}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label">Room count</label>
                    <input
                      type="number"
                      name="roomCount"
                      min={1}
                      className="input"
                      defaultValue={sourceListing?.room_count || sourceRequest?.people_count || 1}
                    />
                  </div>
                  <RoomTypeDropdown value={roomType} onChange={setRoomType} />

                  <div>
                    <label className="label mb-2">Check-in</label>
                    <DatePicker
                      name="checkIn"
                      id="checkIn"
                      placeholder="Check-in"
                      minDate={dateConstraints.min}
                      maxDate={dateConstraints.max}
                      onChange={(date) => setCheckInDate(date)}
                      defaultValue={sourceListing?.check_in || undefined}
                    />
                  </div>
                  <div>
                    <label className="label mb-2">Check-out</label>
                    <DatePicker
                      name="checkOut"
                      id="checkOut"
                      placeholder="Check-out"
                      minDate={checkInDate || dateConstraints.min}
                      maxDate={dateConstraints.max}
                      defaultValue={sourceListing?.check_out || undefined}
                    />
                  </div>
                </div>
              </section>
            )}

            {(listingType === "bib" || listingType === "room_and_bib") && (
              <section className="space-y-4 border-t border-slate-200 pt-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Bibs</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label">Bibs available</label>
                    <input
                      type="number"
                      name="bibCount"
                      min={1}
                      className="input"
                      defaultValue={sourceListing?.bib_count || sourceRequest?.people_count || 1}
                    />
                  </div>
                  <div>
                    <label className="label">Transfer method</label>
                    <select name="transferType" className="input" defaultValue={sourceListing?.transfer_type || ""}>
                      <option value="">Select</option>
                      <option value="official_process">Official process</option>
                      <option value="self_managed">Self managed</option>
                      <option value="package">Package transfer</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Associated costs (optional)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    name="associatedCosts"
                    className="input w-full md:w-56"
                    defaultValue={
                      sourceListing?.associated_costs !== null && sourceListing?.associated_costs !== undefined
                        ? String(sourceListing.associated_costs)
                        : ""
                    }
                  />
                </div>
              </section>
            )}

            <section className="space-y-4 border-t border-slate-200 pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Price + Notes</h2>
              <div>
                <label className="label">Price per person/package</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    name="price"
                    className="input w-36"
                    value={priceValue}
                    onChange={(e) => setPriceValue(e.target.value)}
                  />
                  <CurrencyPicker value={currency} onChange={setCurrency} />
                </div>
              </div>

              {(listingType === "room" || listingType === "room_and_bib") && (
                <div>
                  <input type="hidden" name="priceNegotiable" value={priceNegotiable ? "true" : "false"} />
                  <span className="text-sm text-slate-700">Price negotiable</span>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPriceNegotiable(true)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${priceNegotiable ? "bg-emerald-100 text-emerald-700" : "border border-slate-300 text-slate-700"}`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriceNegotiable(false)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${!priceNegotiable ? "bg-emerald-100 text-emerald-700" : "border border-slate-300 text-slate-700"}`}
                    >
                      No
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="label">Description / package details</label>
                <textarea
                  name="description"
                  rows={6}
                  className="input"
                  placeholder="Hotel, activities, inclusions, exclusions, per-person total, and additional notes"
                  defaultValue={sourceListing?.description || sourceRequest?.quote_summary || sourceRequest?.notes || sourceRequest?.public_note || ""}
                />
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
              <button type="submit" className="btn-primary rounded-full px-6">
                {sourceListing ? "Save Changes" : "Create Event Listing"}
              </button>
              {created && actionData && "listingId" in actionData && actionData.listingId && (
                <button
                  type="button"
                  onClick={() => navigate(`/listings/${String(actionData.listingId)}`)}
                  className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Open Listing
                </button>
              )}
            </div>
          </Form>
        </div>
      </main>
    </div>
  );
}
