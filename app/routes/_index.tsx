import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { getUser } from "~/lib/session.server";
import { supabase } from "~/lib/supabase.server";
import { Header } from "~/components/Header";
import { ListingCard } from "~/components/ListingCard";

export const meta: MetaFunction = () => {
  return [
    { title: "RunStay Exchange - Marathon Room & Bib Marketplace" },
    {
      name: "description",
      content:
        "Exchange unsold hotel rooms and bibs for marathons. Connect tour operators and runners.",
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
    .limit(6);

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

      {/* How it works */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-gray-900">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Simple, fast, and direct
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <h3 className="mt-6 font-display text-xl font-semibold text-gray-900">
                1. Post Your Listing
              </h3>
              <p className="mt-2 text-gray-600">
                Have unsold rooms or bibs? Create a listing in seconds.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-100 text-accent-600">
                <svg
                  className="h-8 w-8"
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
              </div>
              <h3 className="mt-6 font-display text-xl font-semibold text-gray-900">
                2. Connect Directly
              </h3>
              <p className="mt-2 text-gray-600">
                Interested buyers message you through our platform.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="mt-6 font-display text-xl font-semibold text-gray-900">
                3. Close the Deal
              </h3>
              <p className="mt-2 text-gray-600">
                Agree on terms and complete the transaction your way.
              </p>
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
                to="/listings"
                className="text-brand-600 hover:text-brand-700 font-medium"
              >
                View all →
              </Link>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing: any) => (
                <ListingCard key={listing.id} listing={listing} />
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
            © {new Date().getFullYear()} RunStay Exchange. Platform for
            informational purposes only. Transactions are between users.
          </p>
        </div>
      </footer>
    </div>
  );
}
