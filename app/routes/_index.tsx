import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { getUser } from "~/lib/session.server";
import { supabase } from "~/lib/supabase.server";
import { Header } from "~/components/Header";
import { ListingCard } from "~/components/ListingCard";
import { ListingCardCompact } from "~/components/ListingCardCompact";


export const meta: MetaFunction = () => {
  return [
    { title: "Runoot - Room & Bibs Exchange Marketplace" },
    {
      name: "description",
      content:
        "Exchange unsold hotel rooms and bibs for running events. Connect tour operators and runners.",
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);

  // Carica ultimi 6 annunci attivi
  const { data: listings } = await supabase
    .from("listings")
    .select(
      `
      *,
      author:profiles(id, full_name, company_name, user_type, is_verified),
      event:events(id, name, location, event_date)
    `
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(3);

  return { user, listings: listings || [] };
}

export default function Index() {
  const { user, listings } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-full">
      <Header user={user} />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Don't Let Rooms
              <span className="block text-brand-200">Go Empty</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-brand-100">
              The marketplace for tour operators and runners to exchange unsold
              hotel rooms and marathon bibs. Turn cancellations into
              opportunities.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/listings" className="btn-primary text-lg px-8 py-3">
                Browse Listings
              </Link>
              {!user && (
                <Link
                  to="/register"
                  className="btn bg-white/10 text-white border border-white/20 hover:bg-white/20 text-lg px-8 py-3"
                >
                  Create Account
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>


      {/* Recent Listings */}
{listings.length > 0 && (
  <section className="py-20 bg-gray-50">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-3xl font-bold text-gray-900">
          Recent Listings
        </h2>
        <Link
          to={user ? "/listings" : "/login"}
          className="text-brand-600 hover:text-brand-700 font-medium"
        >
          View all →
        </Link>
      </div>

      {/* Desktop: Grid di card */}
      <div className="mt-8 hidden md:grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing: any) => (
          <ListingCard key={listing.id} listing={listing} isUserLoggedIn={!!user} />
        ))}
      </div>

      {/* Mobile: Lista verticale compatta */}
      <div className="mt-6 flex flex-col gap-3 md:hidden">
        {listings.map((listing: any) => (
          <ListingCardCompact key={listing.id} listing={listing} isUserLoggedIn={!!user} />
        ))}
      </div>
    </div>
  </section>
)}


      {/* CTA */}
      <section className="py-20 bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl font-bold text-white">
            Ready to get started?
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            Join tour operators and runners already using RunStay Exchange.
          </p>
          <div className="mt-8">
            {user ? (
              <Link to="/listings/new" className="btn-primary text-lg px-8 py-3">
                Create a Listing
              </Link>
            ) : (
              <Link to="/register" className="btn-primary text-lg px-8 py-3">
                Create Free Account
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            © {new Date().getFullYear()} Runoot Exchange. Platform for
            informational purposes only. Transactions are between users.
          </p>
        </div>
      </footer>
    </div>
  );
}
