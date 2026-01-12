import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { getUser } from "~/lib/session.server";
import { supabase } from "~/lib/supabase.server";
import { Header } from "~/components/Header";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [{ title: data?.listing?.title || "Listing - RunStay Exchange" }];
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
    .eq("id", id)
    .single();

  if (error || !listing) {
    throw new Response("Listing not found", { status: 404 });
  }

  return { user, listing };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect(`/login?redirectTo=/listings/${params.id}`);
  }

  const { id } = params;

  // Get the listing to find the author
  const { data: listing } = await supabase
    .from("listings")
    .select("author_id")
    .eq("id", id)
    .single();

  if (!listing) {
    return json({ error: "Listing not found" }, { status: 404 });
  }

  if (listing.author_id === user.id) {
    return json({ error: "You cannot message yourself" }, { status: 400 });
  }

  // Check if conversation already exists
  const { data: existingConversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("listing_id", id)
    .or(
      `and(participant_1.eq.${user.id},participant_2.eq.${listing.author_id}),and(participant_1.eq.${listing.author_id},participant_2.eq.${user.id})`
    )
    .single();

  if (existingConversation) {
    return redirect(`/messages/${existingConversation.id}`);
  }

  // Create new conversation
  const { data: newConversation, error } = await supabase
    .from("conversations")
    .insert({
      listing_id: id!,
      participant_1: user.id,
      participant_2: listing.author_id,
    })
    .select()
    .single();

  if (error) {
    return json({ error: "Failed to start conversation" }, { status: 500 });
  }

  return redirect(`/messages/${newConversation.id}`);
}

const typeLabels = {
  room: "Room Only",
  bib: "Bib Only",
  room_and_bib: "Room + Bib",
};

const typeColors = {
  room: "bg-blue-100 text-blue-700",
  bib: "bg-purple-100 text-purple-700",
  room_and_bib: "bg-brand-100 text-brand-700",
};

export default function ListingDetail() {
  const { user, listing } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const eventDate = new Date(listing.event.event_date).toLocaleDateString(
    "en-GB",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );

  const isOwner = user?.id === listing.author_id;

  return (
    <div className="min-h-full bg-gray-50">
      <Header user={user} />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          to="/listings"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to listings
        </Link>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      typeColors[listing.listing_type as keyof typeof typeColors]
                    }`}
                  >
                    {typeLabels[listing.listing_type as keyof typeof typeLabels]}
                  </span>
                  <h1 className="mt-4 font-display text-2xl font-bold text-gray-900 sm:text-3xl">
                    {listing.title}
                  </h1>
                </div>
                {listing.status !== "active" && (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                    {listing.status === "sold" ? "Sold" : "Expired"}
                  </span>
                )}
              </div>

              {/* Event info */}
              <div className="mt-6 flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {listing.event.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {listing.event.location}, {listing.event.country} ·{" "}
                    {eventDate}
                  </p>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="card p-6">
              <h2 className="font-display text-lg font-semibold text-gray-900 mb-4">
                Details
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Room details */}
                {(listing.listing_type === "room" ||
                  listing.listing_type === "room_and_bib") && (
                  <>
                    {listing.hotel_name && (
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                          <svg
                            className="h-5 w-5"
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
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Hotel</p>
                          <p className="font-medium text-gray-900">
                            {listing.hotel_name}
                            {listing.hotel_stars && (
                              <span className="ml-1 text-yellow-500">
                                {"★".repeat(listing.hotel_stars)}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {listing.room_count && (
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Rooms</p>
                          <p className="font-medium text-gray-900">
                            {listing.room_count} room
                            {listing.room_count > 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    )}

                    {listing.check_in && listing.check_out && (
                      <div className="flex items-center gap-3 sm:col-span-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Dates</p>
                          <p className="font-medium text-gray-900">
                            {new Date(listing.check_in).toLocaleDateString()} →{" "}
                            {new Date(listing.check_out).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Bib details */}
                {(listing.listing_type === "bib" ||
                  listing.listing_type === "room_and_bib") &&
                  listing.bib_count && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                        <svg
                          className="h-5 w-5"
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
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Bibs</p>
                        <p className="font-medium text-gray-900">
                          {listing.bib_count} bib
                          {listing.bib_count > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  )}
              </div>

              {/* Description */}
              {listing.description && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <h3 className="font-medium text-gray-900 mb-2">
                    Additional Information
                  </h3>
                  <p className="text-gray-600 whitespace-pre-wrap">
                    {listing.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Price card */}
            <div className="card p-6">
              <div className="text-center">
                {listing.price ? (
                  <>
                    <p className="text-3xl font-bold text-gray-900">
                      €{listing.price.toLocaleString()}
                    </p>
                    {listing.price_negotiable && (
                      <p className="mt-1 text-sm text-gray-500">
                        Price negotiable
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xl font-medium text-gray-600">
                    Contact for price
                  </p>
                )}
              </div>

              {actionData?.error && (
                <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {actionData.error}
                </div>
              )}

              {listing.status === "active" && !isOwner && (
                <Form method="post" className="mt-6">
                  <button type="submit" className="btn-primary w-full">
                    <svg
                      className="h-5 w-5 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    Contact Seller
                  </button>
                </Form>
              )}

              {isOwner && (
                <div className="mt-6 space-y-3">
                  <Link
                    to={`/listings/${listing.id}/edit`}
                    className="btn-secondary w-full"
                  >
                    Edit Listing
                  </Link>
                </div>
              )}

              {!user && listing.status === "active" && (
                <div className="mt-6">
                  <Link
                    to={`/login?redirectTo=/listings/${listing.id}`}
                    className="btn-primary w-full"
                  >
                    Login to Contact
                  </Link>
                </div>
              )}
            </div>

            {/* Seller card */}
            <div className="card p-6">
              <h3 className="font-medium text-gray-900 mb-4">Seller</h3>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold text-lg">
                  {listing.author.company_name?.charAt(0) ||
                    listing.author.full_name?.charAt(0) ||
                    "?"}
                </div>
                <div>
                  <p className="font-medium text-gray-900 flex items-center gap-1">
                    {listing.author.company_name || listing.author.full_name}
                    {listing.author.is_verified && (
                      <svg
                        className="h-5 w-5 text-brand-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">
                    {listing.author.user_type === "tour_operator"
                      ? "Tour Operator"
                      : "Private Seller"}
                  </p>
                </div>
              </div>
            </div>

            {/* Safety tips */}
            <div className="card p-6 bg-amber-50 border-amber-200">
              <h3 className="font-medium text-amber-900 mb-2">Safety Tips</h3>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• Verify the seller's identity before payment</li>
                <li>• Use secure payment methods (PayPal, bank transfer)</li>
                <li>• Get written confirmation of the transaction</li>
                <li>• Report suspicious activity</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
