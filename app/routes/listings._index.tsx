import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useLoaderData, useSearchParams, Form } from "@remix-run/react";
import { getUser } from "~/lib/session.server";
import { supabase } from "~/lib/supabase.server";
import { Header } from "~/components/Header";
import { ListingCard } from "~/components/ListingCard";

export const meta: MetaFunction = () => {
  return [{ title: "Browse Listings - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  const url = new URL(request.url);

  const type = url.searchParams.get("type");
  const search = url.searchParams.get("search");

  // Demo mode: return mock data
  if (process.env.DISABLE_AUTH === "true") {
    const mockListings = [
      {
        id: "1",
        title: "2 Hotel Rooms + 2 Bibs - Berlin Marathon 2025",
        description: "Premium hotel near start line, includes breakfast",
        listing_type: "room_and_bib",
        price: 450,
        price_negotiable: true,
        transfer_type: "package",
        associated_costs: 450,
        status: "active",
        hotel_name: "Hotel Berlin Central",
        hotel_stars: 4,
        room_count: 2,
        bib_count: 2,
        check_in: "2025-09-26",
        check_out: "2025-09-29",
        created_at: new Date().toISOString(),
        author: {
          id: "demo-1",
          full_name: "Marco Rossi",
          company_name: "Run Tours Italia",
          user_type: "tour_operator",
          is_verified: true,
        },
        event: {
          id: "event-1",
          name: "Berlin Marathon 2025",
          location: "Berlin",
          event_date: "2025-09-28",
        },
      },
      {
        id: "2",
        title: "1 Marathon Bib - London Marathon 2025",
        description: "Can't run anymore, looking to sell my bib",
        listing_type: "bib",
        transfer_type: "official_process",
        associated_costs: 80,
        status: "active",
        bib_count: 1,
        created_at: new Date().toISOString(),
        author: {
          id: "demo-2",
          full_name: "Sarah Johnson",
          company_name: null,
          user_type: "private",
          is_verified: false,
        },
        event: {
          id: "event-2",
          name: "London Marathon 2025",
          location: "London",
          event_date: "2025-04-27",
        },
      },
      {
        id: "3",
        title: "3 Hotel Rooms - New York Marathon 2025",
        description: "Excellent location in Manhattan, walking distance to Central Park",
        listing_type: "room",
        price: 600,
        price_negotiable: true,
        status: "active",
        hotel_name: "Manhattan Runner's Hotel",
        hotel_stars: 5,
        room_count: 3,
        check_in: "2025-11-01",
        check_out: "2025-11-04",
        created_at: new Date().toISOString(),
        author: {
          id: "demo-3",
          full_name: "John Smith",
          company_name: "NYC Marathon Tours",
          user_type: "tour_operator",
          is_verified: true,
        },
        event: {
          id: "event-3",
          name: "New York City Marathon 2025",
          location: "New York",
          event_date: "2025-11-02",
        },
      },
    ];

    let filteredListings = mockListings;

    if (type && type !== "all") {
      filteredListings = filteredListings.filter((l) => l.listing_type === type);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredListings = filteredListings.filter(
        (l) =>
          l.event?.name?.toLowerCase().includes(searchLower) ||
          l.event?.location?.toLowerCase().includes(searchLower) ||
          l.title?.toLowerCase().includes(searchLower)
      );
    }

    return { user, listings: filteredListings };
  }

  let query = supabase
    .from("listings")
    .select(
      `
      *,
      author:profiles(id, full_name, company_name, user_type, is_verified),
      event:events(id, name, location, event_date)
    `
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (type && type !== "all") {
    query = query.eq("listing_type", type);
  }

  const { data: listings, error } = await query;

  if (error) {
    console.error("Error loading listings:", error);
    return { user, listings: [] };
  }

  // Filter by search (event name or location) - client side for simplicity
  let filteredListings = listings || [];
  if (search) {
    const searchLower = search.toLowerCase();
    filteredListings = filteredListings.filter(
      (l: any) =>
        l.event?.name?.toLowerCase().includes(searchLower) ||
        l.event?.location?.toLowerCase().includes(searchLower) ||
        l.title?.toLowerCase().includes(searchLower)
    );
  }

  return { user, listings: filteredListings };
}

export default function Listings() {
  const { user, listings } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const currentType = searchParams.get("type") || "all";
  const currentSearch = searchParams.get("search") || "";

  return (
    <div className="min-h-full bg-gray-50">
      <Header user={user} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-gray-900">
            Browse Listings
          </h1>
          <p className="mt-2 text-gray-600">
            Find available rooms and bibs for upcoming marathons
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8 card p-4">
          <Form method="get" className="flex flex-col gap-4 sm:flex-row">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                name="search"
                placeholder="Search by event name or location..."
                defaultValue={currentSearch}
                className="input"
              />
            </div>

            {/* Type filter */}
            <div className="sm:w-48">
              <select name="type" defaultValue={currentType} className="input">
                <option value="all">All types</option>
                <option value="room">Room only</option>
                <option value="bib">Bib only</option>
                <option value="room_and_bib">Room + Bib</option>
              </select>
            </div>

            <button type="submit" className="btn-primary">
              Search
            </button>
          </Form>
        </div>

        {/* Results */}
        {listings.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing: any) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No listings found
            </h3>
            <p className="mt-2 text-gray-600">
              {currentSearch || currentType !== "all"
                ? "Try adjusting your filters"
                : "Be the first to create a listing!"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
