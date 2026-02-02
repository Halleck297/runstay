import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";
import { FooterLight } from "~/components/FooterLight";
import { ListingCard } from "~/components/ListingCard";
import { ListingCardCompact } from "~/components/ListingCardCompact";

export const meta: MetaFunction = () => {
  return [{ title: "Saved Listings - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const userId = (user as any).id as string;

  const { data: savedListings, error } = await (supabaseAdmin as any)
    .from("saved_listings")
    .select(`
      id,
      created_at,
      listing:listings(
        id,
        title,
        listing_type,
        hotel_name,
        hotel_stars,
        hotel_rating,
        room_count,
        room_type,
        bib_count,
        price,
        currency,
        price_negotiable,
        transfer_type,
        associated_costs,
        check_in,
        check_out,
        status,
        created_at,
        author:profiles(id, full_name, company_name, user_type, is_verified),
        event:events(id, name, country, event_date)
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching saved listings:", error);
    return { user, savedListings: [] };
  }

  // Filter out null listings (in case a listing was deleted) and inactive listings
  const activeListings = savedListings
    ?.filter((s: any) => s.listing && s.listing.status === "active")
    .map((s: any) => s.listing) || [];

  return { user, savedListings: activeListings };
}

export default function SavedListings() {
  const { user, savedListings } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-[url('/savedBG.png')] bg-cover bg-center bg-fixed">
      <div className="min-h-screen bg-gray-50/60 md:bg-gray-50/85 flex flex-col">
        <Header user={user} />

        <main className="mx-auto max-w-7xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8 flex-grow w-full">
          <div className="mb-8 bg-white/70 backdrop-blur-sm rounded-xl shadow-md px-3 py-4 sm:p-6">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 text-center sm:text-left">
              Saved Listings
            </h1>
            <p className="hidden sm:block mt-2 text-gray-600">
              Listings you've saved for later
            </p>
          </div>

        {savedListings.length === 0 ? (
          <div className="card p-12 text-center shadow-md">
            <svg
              className="mx-auto h-16 w-16 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No saved listings yet
            </h3>
            <p className="mt-2 text-gray-500">
              When you find a listing you like, click the heart icon to save it here.
            </p>
            <Link to="/listings" className="btn-primary rounded-full mt-6 inline-block">
              Browse Listings
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop: Grid di card */}
            <div className="hidden md:grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {savedListings.map((listing: any) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isUserLoggedIn={true}
                  isSaved={true}
                />
              ))}
            </div>

            {/* Mobile: Lista verticale compatta */}
            <div className="flex flex-col gap-3 md:hidden">
              {savedListings.map((listing: any) => (
                <ListingCardCompact
                  key={listing.id}
                  listing={listing}
                  isUserLoggedIn={true}
                  isSaved={true}
                />
              ))}
            </div>
          </>
        )}
        </main>

        <FooterLight />
      </div>
    </div>
  );
}
