import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { requireUser } from "~/lib/session.server";
import { supabase } from "~/lib/supabase.server";
import { Header } from "~/components/Header";

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

  return { user, events: events || [] };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();

  const listingType = formData.get("listingType") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;

  // Event fields
  const eventId = formData.get("eventId") as string;
  const newEventName = formData.get("newEventName") as string;
  const newEventLocation = formData.get("newEventLocation") as string;
  const newEventCountry = formData.get("newEventCountry") as string;
  const newEventDate = formData.get("newEventDate") as string;

  // Room fields
  const hotelName = formData.get("hotelName") as string;
  const hotelStars = formData.get("hotelStars") as string;
  const roomCount = formData.get("roomCount") as string;
  const checkIn = formData.get("checkIn") as string;
  const checkOut = formData.get("checkOut") as string;

  // Bib fields
  const bibCount = formData.get("bibCount") as string;

  // Price
  const price = formData.get("price") as string;
  const priceNegotiable = formData.get("priceNegotiable") === "on";

  // Validation
  if (!listingType || !title) {
    return json({ error: "Type and title are required" }, { status: 400 });
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
      })
      .select()
      .single();

    if (eventError) {
      return json({ error: "Failed to create event" }, { status: 400 });
    }

    finalEventId = newEvent.id;
  }

  if (!finalEventId) {
    return json({ error: "Please select or create an event" }, { status: 400 });
  }

  // Create listing
  const { data: listing, error } = await supabase
    .from("listings")
    .insert({
      author_id: user.id,
      event_id: finalEventId,
      listing_type: listingType as "room" | "bib" | "room_and_bib",
      title,
      description: description || null,
      hotel_name: hotelName || null,
      hotel_stars: hotelStars ? parseInt(hotelStars) : null,
      room_count: roomCount ? parseInt(roomCount) : null,
      check_in: checkIn || null,
      check_out: checkOut || null,
      bib_count: bibCount ? parseInt(bibCount) : null,
      price: price ? parseFloat(price) : null,
      price_negotiable: priceNegotiable,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    console.error("Listing creation error:", error);
    return json({ error: "Failed to create listing" }, { status: 400 });
  }

  return redirect(`/listings/${listing.id}`);
}

export default function NewListing() {
  const { user, events } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="min-h-full bg-gray-50">
      <Header user={user} />

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-gray-900">
            Create a Listing
          </h1>
          <p className="mt-2 text-gray-600">
            Share your available rooms or bibs with the community
          </p>
        </div>

        <div className="card p-6 sm:p-8">
          <Form method="post" className="space-y-8">
            {actionData?.error && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {actionData.error}
              </div>
            )}

            {/* Listing Type */}
            <div>
              <label className="label">What are you offering?</label>
              <div className="mt-2 grid grid-cols-3 gap-3">
                <label className="relative flex cursor-pointer rounded-lg border border-gray-300 bg-white p-4 shadow-sm focus:outline-none hover:border-brand-500 has-[:checked]:border-brand-500 has-[:checked]:ring-1 has-[:checked]:ring-brand-500">
                  <input
                    type="radio"
                    name="listingType"
                    value="room"
                    className="sr-only"
                    defaultChecked
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
                <label className="relative flex cursor-pointer rounded-lg border border-gray-300 bg-white p-4 shadow-sm focus:outline-none hover:border-brand-500 has-[:checked]:border-brand-500 has-[:checked]:ring-1 has-[:checked]:ring-brand-500">
                  <input
                    type="radio"
                    name="listingType"
                    value="bib"
                    className="sr-only"
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
                <label className="relative flex cursor-pointer rounded-lg border border-gray-300 bg-white p-4 shadow-sm focus:outline-none hover:border-brand-500 has-[:checked]:border-brand-500 has-[:checked]:ring-1 has-[:checked]:ring-brand-500">
                  <input
                    type="radio"
                    name="listingType"
                    value="room_and_bib"
                    className="sr-only"
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

            {/* Title */}
            <div>
              <label htmlFor="title" className="label">
                Listing title
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                placeholder="e.g. 2 rooms at Hilton for Berlin Marathon"
                className="input"
              />
            </div>

            {/* Event Selection */}
            <div className="space-y-4">
              <label className="label">Marathon Event</label>

              {events.length > 0 && (
                <div>
                  <select name="eventId" className="input">
                    <option value="">-- Select existing event --</option>
                    {events.map((event: any) => (
                      <option key={event.id} value={event.id}>
                        {event.name} - {event.location} (
                        {new Date(event.event_date).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500">
                    Or create new event
                  </span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="newEventName" className="label">
                    Event name
                  </label>
                  <input
                    type="text"
                    id="newEventName"
                    name="newEventName"
                    placeholder="e.g. Berlin Marathon 2025"
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="newEventDate" className="label">
                    Event date
                  </label>
                  <input
                    type="date"
                    id="newEventDate"
                    name="newEventDate"
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="newEventLocation" className="label">
                    City
                  </label>
                  <input
                    type="text"
                    id="newEventLocation"
                    name="newEventLocation"
                    placeholder="e.g. Berlin"
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="newEventCountry" className="label">
                    Country
                  </label>
                  <input
                    type="text"
                    id="newEventCountry"
                    name="newEventCountry"
                    placeholder="e.g. Germany"
                    className="input"
                  />
                </div>
              </div>
            </div>

            {/* Room Details */}
            <div className="space-y-4" id="roomFields">
              <h3 className="font-medium text-gray-900 border-b pb-2">
                Room Details
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="hotelName" className="label">
                    Hotel name
                  </label>
                  <input
                    type="text"
                    id="hotelName"
                    name="hotelName"
                    placeholder="e.g. Hilton Berlin"
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="hotelStars" className="label">
                    Stars
                  </label>
                  <select id="hotelStars" name="hotelStars" className="input">
                    <option value="">Select</option>
                    <option value="2">2 stars</option>
                    <option value="3">3 stars</option>
                    <option value="4">4 stars</option>
                    <option value="5">5 stars</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="roomCount" className="label">
                    Number of rooms
                  </label>
                  <input
                    type="number"
                    id="roomCount"
                    name="roomCount"
                    min="1"
                    placeholder="e.g. 2"
                    className="input"
                  />
                </div>
                <div></div>
                <div>
                  <label htmlFor="checkIn" className="label">
                    Check-in date
                  </label>
                  <input
                    type="date"
                    id="checkIn"
                    name="checkIn"
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="checkOut" className="label">
                    Check-out date
                  </label>
                  <input
                    type="date"
                    id="checkOut"
                    name="checkOut"
                    className="input"
                  />
                </div>
              </div>
            </div>

            {/* Bib Details */}
            <div className="space-y-4" id="bibFields">
              <h3 className="font-medium text-gray-900 border-b pb-2">
                Bib Details
              </h3>
              <div>
                <label htmlFor="bibCount" className="label">
                  Number of bibs
                </label>
                <input
                  type="number"
                  id="bibCount"
                  name="bibCount"
                  min="1"
                  placeholder="e.g. 1"
                  className="input w-full sm:w-48"
                />
              </div>
            </div>

            {/* Price */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">Price</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="price" className="label">
                    Price (€)
                  </label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    min="0"
                    step="0.01"
                    placeholder="Leave empty for 'Contact for price'"
                    className="input"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="priceNegotiable"
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-gray-700">
                      Price is negotiable
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="label">
                Additional details{" "}
                <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                placeholder="Any other information buyers should know..."
                className="input"
              />
            </div>

            {/* Submit */}
            <div className="flex gap-4 pt-4">
              <button type="submit" className="btn-primary flex-1">
                Create Listing
              </button>
            </div>
          </Form>
        </div>
      </main>
    </div>
  );
}
