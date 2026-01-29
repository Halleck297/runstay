import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams, Form } from "react-router";
import { getUser } from "~/lib/session.server";
import { supabase, supabaseAdmin } from "~/lib/supabase.server";
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
    return { user, listings: [], savedListingIds: [] };
  }

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

  let savedListingIds: string[] = [];
  if (user) {
    const { data: savedListings } = await (supabaseAdmin as any)
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

  const typeFilters = [
    { value: "all", label: "All", icon: null },
    {
      value: "room",
      label: "Rooms",
      color: "emerald",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      value: "bib",
      label: "Bibs",
      color: "orange",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      ),
    },
    {
      value: "room_and_bib",
      label: "Packages",
      color: "blue",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
  ];

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

        <div className="relative mx-auto max-w-7xl px-6 py-12 lg:py-16">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-sm text-emerald-300 font-medium">
                    {listings.length} available
                  </span>
                </div>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                Browse Listings
              </h1>
              <p className="text-stone-300 text-lg">
                Find available rooms and bibs for upcoming marathons
              </p>
            </div>

            {/* Search Form */}
            <Form method="get" className="w-full lg:w-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 lg:w-80">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    name="search"
                    placeholder="Search events or locations..."
                    defaultValue={currentSearch}
                    className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  />
                </div>
                <input type="hidden" name="type" value={currentType} />
                <button
                  type="submit"
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-stone-900 font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Search</span>
                </button>
              </div>
            </Form>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-stone-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Type Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-hide">
              {typeFilters.map((filter) => {
                const isActive = currentType === filter.value;
                const colorClasses: Record<string, string> = {
                  emerald: isActive ? "bg-emerald-500 text-white border-emerald-500" : "hover:border-emerald-300 hover:bg-emerald-50",
                  orange: isActive ? "bg-orange-500 text-white border-orange-500" : "hover:border-orange-300 hover:bg-orange-50",
                  blue: isActive ? "bg-blue-500 text-white border-blue-500" : "hover:border-blue-300 hover:bg-blue-50",
                };

                return (
                  <Form key={filter.value} method="get">
                    <input type="hidden" name="type" value={filter.value} />
                    {currentSearch && <input type="hidden" name="search" value={currentSearch} />}
                    <button
                      type="submit"
                      className={`
                        inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-medium text-sm transition-all whitespace-nowrap
                        ${filter.value === "all"
                          ? isActive
                            ? "bg-stone-900 text-white border-stone-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50"
                          : `border-stone-200 text-stone-600 ${colorClasses[filter.color || ""]}`
                        }
                      `}
                    >
                      {filter.icon}
                      {filter.label}
                    </button>
                  </Form>
                );
              })}
            </div>

            {/* Results count - desktop */}
            <div className="hidden sm:flex items-center gap-2 text-sm text-stone-500">
              <span className="font-medium text-stone-900">{listings.length}</span>
              <span>listings found</span>
            </div>
          </div>

          {/* Active filters */}
          {(currentSearch || currentType !== "all") && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-stone-100">
              <span className="text-xs text-stone-400 uppercase tracking-wider">Active filters:</span>
              <div className="flex items-center gap-2 flex-wrap">
                {currentSearch && (
                  <Form method="get" className="inline-flex">
                    <input type="hidden" name="type" value={currentType} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-100 hover:bg-stone-200 rounded-full text-sm text-stone-700 transition-colors"
                    >
                      <span>"{currentSearch}"</span>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </Form>
                )}
                {currentType !== "all" && (
                  <Form method="get" className="inline-flex">
                    {currentSearch && <input type="hidden" name="search" value={currentSearch} />}
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-100 hover:bg-stone-200 rounded-full text-sm text-stone-700 transition-colors"
                    >
                      <span>{typeFilters.find(f => f.value === currentType)?.label}</span>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </Form>
                )}
                <Form method="get">
                  <button
                    type="submit"
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Clear all
                  </button>
                </Form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {listings.length > 0 ? (
          <>
            {/* Desktop: Grid */}
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

            {/* Mobile: Compact List */}
            <div className="flex flex-col gap-4 md:hidden">
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
          /* Empty State */
          <div className="text-center py-20">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-50 flex items-center justify-center mb-6">
              <svg
                className="w-10 h-10 text-stone-300"
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
            </div>
            <h3 className="text-2xl font-bold text-stone-900 mb-3">
              No listings found
            </h3>
            <p className="text-stone-500 mb-8 max-w-md mx-auto">
              {currentSearch || currentType !== "all"
                ? "Try adjusting your search or filters to find what you're looking for"
                : "Be the first to create a listing and help other runners!"}
            </p>
            
            {(currentSearch || currentType !== "all") && (
              <Form method="get" className="inline-flex">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear all filters
                </button>
              </Form>
            )}

            {/* Suggestions */}
            {!currentSearch && currentType === "all" && (
              <div className="mt-12 pt-8 border-t border-stone-100 max-w-lg mx-auto">
                <p className="text-xs text-stone-400 uppercase tracking-wider mb-4">Popular searches</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {["Milan Marathon", "Berlin Marathon", "NYC Marathon", "Boston Marathon"].map((event) => (
                    <Form key={event} method="get">
                      <input type="hidden" name="search" value={event} />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-white border border-stone-200 hover:border-emerald-300 hover:bg-emerald-50 rounded-full text-sm text-stone-600 hover:text-emerald-700 transition-colors"
                      >
                        {event}
                      </button>
                    </Form>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
