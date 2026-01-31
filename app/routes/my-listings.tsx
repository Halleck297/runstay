import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect } from "react-router";
import { Link, useLoaderData } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";
import { ListingCard } from "~/components/ListingCard";

export const meta: MetaFunction = () => {
  return [{ title: "My Listings - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  // Get user's listings
  const { data: listings } = await supabaseAdmin
    .from("listings")
    .select(`
      *,
      event:events(id, name, country, event_date),
      author:profiles(id, full_name, company_name, user_type, is_verified)
    `)
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });

  const userListings = listings || [];

  // For private users: if they have exactly 1 listing, redirect to its detail page
  if (user.user_type === "private" && userListings.length === 1) {
    return redirect(`/listings/${userListings[0].id}`);
  }

  // For tour operators, always redirect to dashboard
  if (user.user_type === "tour_operator") {
    return redirect("/dashboard");
  }

  // Split listings into active (event in future) and ended (event passed)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeListings = userListings.filter((listing: any) => {
    const eventDate = new Date(listing.event.event_date);
    return eventDate >= today;
  });

  const endedListings = userListings.filter((listing: any) => {
    const eventDate = new Date(listing.event.event_date);
    return eventDate < today;
  });

  return { user, activeListings, endedListings };
}

export default function MyListings() {
  const { user, activeListings, endedListings } = useLoaderData<typeof loader>();
  const totalListings = activeListings.length + endedListings.length;

  return (
    <div className="min-h-full bg-[url('/savedBG.png')] bg-cover bg-center bg-fixed">
      <div className="min-h-full bg-gray-50/85">
        <Header user={user} />

        <main className="mx-auto max-w-7xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8">
        <div className="mb-8 bg-white/70 backdrop-blur-sm rounded-xl shadow-md p-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-gray-900">
              My Listings
            </h1>
            <p className="mt-2 text-gray-600">
              {totalListings === 0
                ? "You haven't created any listings yet"
                : `You have ${totalListings} listing${totalListings > 1 ? "s" : ""}`}
            </p>
          </div>
          {activeListings.length > 0 && (
            <span className="font-display text-xl font-semibold text-gray-900">
              Active ({activeListings.length})
            </span>
          )}
        </div>

        {totalListings > 0 ? (
          <div className="space-y-10">
            {/* Active Listings */}
            {activeListings.length > 0 && (
              <section>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {activeListings.map((listing: any) => (
                    <ListingCard key={listing.id} listing={listing} isUserLoggedIn={true} />
                  ))}
                </div>
              </section>
            )}

            {/* Ended Listings */}
            {endedListings.length > 0 && (
              <section>
                <h2 className="font-display text-xl font-semibold text-gray-500 mb-4">
                  Ended ({endedListings.length})
                </h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 opacity-60">
                  {endedListings.map((listing: any) => (
                    <ListingCard key={listing.id} listing={listing} isUserLoggedIn={true} />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="h-8 w-8 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No listings yet
            </h3>
            <p className="text-gray-500 mb-6">
              Create your first listing to start exchanging rooms or bibs with other runners.
            </p>
            <Link to="/listings/new" className="btn-primary rounded-full">
              Create your first listing
            </Link>
          </div>
        )}
        </main>
      </div>
    </div>
  );
}
