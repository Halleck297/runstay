import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useLoaderData, useSearchParams, Form } from "@remix-run/react";
import { getUser } from "~/lib/session.server";
import { supabase } from "~/lib/supabase.server";
import { Header } from "~/components/Header";
import { ListingCard } from "~/components/ListingCard";
import { ListingCardCompact } from "~/components/ListingCardCompact";


export const meta: MetaFunction = () => {
  return [{ title: "Browse Listings - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  const url = new URL(request.url);

  const type = url.searchParams.get("type");
  const search = url.searchParams.get("search");


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

     // Get saved listing IDs for this user
  let savedListingIds: string[] = [];
  if (user) {
    const { data: savedListings } = await (supabase as any)
      .from("saved_listings")
      .select("listing_id")
      .eq("user_id", (user as any).id);
    
    savedListingIds = savedListings?.map((s: any) => s.listing_id) || [];
  }


  return { user, listings: filteredListings, savedListingIds };

}

export default function Listings() {
  const { user, listings, savedListingIds } = useLoaderData<typeof loader>();
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
  <>
    {/* Desktop: Grid di card */}
    <div className="hidden md:grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing: any) => (
        <ListingCard 
          key={listing.id} 
          listing={listing} 
          isUserLoggedIn={!!user}
          isSaved={(savedListingIds || []).includes(listing.id)}

        />
      ))}
    </div>

    {/* Mobile: Lista verticale compatta */}
    <div className="flex flex-col gap-3 md:hidden">
      {listings.map((listing: any) => (
        <ListingCardCompact 
          key={listing.id} 
          listing={listing} 
          isUserLoggedIn={!!user}
          isSaved={(savedListingIds || []).includes(listing.id)}

        />
      ))}
    </div>
  </>
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
