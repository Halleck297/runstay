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

  const { data: listings } = await supabaseAdmin
    .from("listings")
    .select(`
      *,
      event:events(id, name, location, event_date),
      author:profiles(id, full_name, company_name, user_type, is_verified)
    `)
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });

  const userListings = listings || [];

  if (user.user_type === "private" && userListings.length === 1) {
    return redirect(`/listings/${userListings[0].id}`);
  }

  if (user.user_type === "tour_operator") {
    return redirect("/dashboard");
  }

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
    <div className="min-h-screen bg-stone-50">
      <Header user={user} />

      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-stone-900 via-stone-800 to-emerald-900 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 py-16 lg:py-20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white">
                  My Listings
                </h1>
                <p className="text-stone-300 mt-1">
                  {totalListings === 0
                    ? "You haven't created any listings yet"
                    : `You have ${totalListings} listing${totalListings > 1 ? "s" : ""}`}
                </p>
              </div>
            </div>

            <Link
              to="/listings/new"
              className="group inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-stone-900 font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Listing</span>
            </Link>
          </div>

          {/* Stats Bar */}
          {totalListings > 0 && (
            <div className="mt-8 flex items-center gap-6">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-sm text-emerald-300 font-medium">
                  {activeListings.length} Active
                </span>
              </div>
              {endedListings.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-stone-500"></span>
                  <span className="text-sm text-stone-400 font-medium">
                    {endedListings.length} Ended
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="relative z-10 mx-auto max-w-7xl px-6 -mt-8 pb-20">
        {totalListings > 0 ? (
          <div className="space-y-12">
            {/* Active Listings */}
            {activeListings.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-stone-900">
                      Active Listings
                    </h2>
                    <p className="text-sm text-stone-500">
                      {activeListings.length} listing{activeListings.length > 1 ? "s" : ""} currently available
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {activeListings.map((listing: any) => (
                    <div key={listing.id} className="group">
                      <ListingCard listing={listing} isUserLoggedIn={true} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Ended Listings */}
            {endedListings.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-stone-500">
                      Ended Listings
                    </h2>
                    <p className="text-sm text-stone-400">
                      {endedListings.length} past listing{endedListings.length > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 opacity-60 grayscale-[30%]">
                  {endedListings.map((listing: any) => (
                    <div key={listing.id}>
                      <ListingCard listing={listing} isUserLoggedIn={true} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          /* Empty State */
          <div className="bg-white rounded-2xl shadow-xl shadow-stone-200/50 border border-stone-100 p-12 text-center">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50 flex items-center justify-center mb-6">
              <svg
                className="h-10 w-10 text-stone-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            
            <h3 className="text-2xl font-bold text-stone-900 mb-3">
              No listings yet
            </h3>
            <p className="text-stone-500 mb-8 max-w-md mx-auto">
              Create your first listing to start exchanging rooms or bibs with other runners and tour operators.
            </p>

            <Link
              to="/listings/new"
              className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Create your first listing</span>
            </Link>

            {/* Helpful Tips */}
            <div className="mt-12 pt-8 border-t border-stone-100">
              <p className="text-xs text-stone-400 uppercase tracking-wider mb-4">What you can list</p>
              <div className="flex flex-wrap justify-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-emerald-700">Hotel Rooms</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-full">
                  <div className="w-6 h-6 rounded-lg bg-orange-500 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-orange-700">Marathon Bibs</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full">
                  <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-blue-700">Packages</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
