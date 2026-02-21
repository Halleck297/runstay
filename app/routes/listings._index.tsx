import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams, Form, useNavigate } from "react-router";
import { useState, useRef, useEffect } from "react";
import { useI18n } from "~/hooks/useI18n";
import { getUser } from "~/lib/session.server";
import { supabase, supabaseAdmin } from "~/lib/supabase.server";
import { detectPreferredLocale, getLocaleFromProfileLanguages, localizeEvent, localizeListing } from "~/lib/locale";
import type { ListingType } from "~/lib/database.types";
import { Header } from "~/components/Header";
import { FooterLight } from "~/components/FooterLight";
import { ListingCard } from "~/components/ListingCard";
import { ListingCardCompact } from "~/components/ListingCardCompact";
import { SortDropdown } from "~/components/SortDropdown";


export const meta: MetaFunction = () => {
  return [{ title: "Browse Listings - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  const locale = getLocaleFromProfileLanguages((user as any)?.languages) ?? detectPreferredLocale(request);
  const url = new URL(request.url);

  const type = url.searchParams.get("type");
  const search = url.searchParams.get("search");


  let query = supabase
    .from("listings")
    .select(
      `
      *,
      author:profiles!listings_author_id_fkey(id, full_name, company_name, user_type, is_verified),
      event:events(id, name, slug, country, event_date)
    `
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (type && type !== "all") {
    const allowedTypes: ListingType[] = ["room", "bib", "room_and_bib"];
    if (allowedTypes.includes(type as ListingType)) {
      query = query.eq("listing_type", type as ListingType);
    }
  }

  const { data: listings, error } = await query;

  if (error) {
    console.error("Error loading listings:", error);
    return { user, listings: [] };
  }

  // Filter by search (event name or location) - client side for simplicity
  let filteredListings = (listings || []).map((listing: any) => localizeListing(listing, locale));
  if (search) {
    const searchLower = search.toLowerCase();
    filteredListings = filteredListings.filter(
      (l: any) =>
        l.event?.name?.toLowerCase().includes(searchLower) ||
        l.event?.country?.toLowerCase().includes(searchLower) ||
        l.title?.toLowerCase().includes(searchLower)
    );
  }

     // Get saved listing IDs for this user
  let savedListingIds: string[] = [];
  if (user) {
    const { data: savedListings } = await (supabaseAdmin as any)
      .from("saved_listings")
      .select("listing_id")
      .eq("user_id", (user as any).id);
    
    savedListingIds = savedListings?.map((s: any) => s.listing_id) || [];
  }


  // Get all events for autocomplete suggestions
  const { data: events } = await supabase
    .from("events")
    .select("id, name, country, event_date")
    .order("event_date", { ascending: true });

  const localizedEvents = (events || []).map((event: any) => localizeEvent(event, locale));
  return { user, listings: filteredListings, savedListingIds, events: localizedEvents };

}

export default function Listings() {
  const { t } = useI18n();
  const { user, listings, savedListingIds, events } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);

  const currentType = searchParams.get("type") || "all";
  const currentSearch = searchParams.get("search") || "";
  const currentSort = searchParams.get("sort") || "newest";

  const [searchQuery, setSearchQuery] = useState(currentSearch);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sortBy, setSortBy] = useState(currentSort);

  // Load More pagination
  const ITEMS_PER_PAGE = 12;

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [currentType, currentSearch, sortBy]);

  // Sort listings based on selected option
  const sortedListings = [...(listings as any[])].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "first_posted":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "event_soonest":
        const dateA = a.event?.event_date ? new Date(a.event.event_date).getTime() : Infinity;
        const dateB = b.event?.event_date ? new Date(b.event.event_date).getTime() : Infinity;
        return dateA - dateB;
      case "price_low":
        // Exclude "contact for price" (null/undefined price), put them at the end
        const priceA = a.price != null ? a.price : Infinity;
        const priceB = b.price != null ? b.price : Infinity;
        return priceA - priceB;
      case "price_high":
        // Exclude "contact for price" (null/undefined price), put them at the end
        const priceHighA = a.price != null ? a.price : -Infinity;
        const priceHighB = b.price != null ? b.price : -Infinity;
        return priceHighB - priceHighA;
      case "contact_price":
        // Show only "contact for price" listings, sorted by newest
        // This is handled by filtering, but we still sort by newest
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      default:
        return 0;
    }
  });

  // Filter for "contact_price" option - show only listings without a price
  const filteredBySort = sortBy === "contact_price"
    ? sortedListings.filter((l) => l.price == null)
    : sortedListings;

  // Pagination
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const visibleListings = filteredBySort.slice(0, visibleCount);
  const hasMore = visibleCount < filteredBySort.length;

  // Filter events based on search query (min 2 chars)
  const filteredEvents = searchQuery.length >= 2
    ? (events as any[]).filter((event) =>
        event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.country.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle suggestion click
  const handleSuggestionClick = (eventName: string) => {
    setSearchQuery(eventName);
    setShowSuggestions(false);
    // Navigate with the selected event name as search
    const params = new URLSearchParams();
    if (currentType !== "all") params.set("type", currentType);
    params.set("search", eventName);
    navigate(`/listings?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[url('/savedBG.png')] bg-cover bg-center bg-fixed">
      <div className="min-h-screen bg-gray-50/60 md:bg-gray-50/85 flex flex-col">
        <Header user={user} />

        <main className="mx-auto max-w-7xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8 flex-grow w-full">
          {/* Page header with Search and Filters */}
          <div className="relative z-10 mb-8 bg-white/70 backdrop-blur-sm rounded-xl shadow-md px-3 py-4 sm:p-6">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 text-center sm:text-left">
              {t("listings.title")}
            </h1>
            <p className="hidden sm:block mt-2 text-gray-600 mb-8">
              {t("listings.subtitle")}
            </p>
            <div className="sm:hidden mb-6" />

            {/* Search Bar with Autocomplete */}
            <Form method="get" name="listing-search" className="mb-6">
              <input type="hidden" name="type" value={currentType} />
              <div className="relative max-w-xl" ref={searchRef}>
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="search"
                  id="listing-search"
                  name="search"
                  autoComplete="off"
                  placeholder={t("listings.search.placeholder")}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="block w-full rounded-full border-0 pl-12 pr-20 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors shadow-md ring-1 ring-gray-200"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-5 py-2 bg-accent-500 text-white text-sm font-medium rounded-full hover:bg-accent-600 transition-all"
                >
                  Search
                </button>

                {/* Autocomplete Dropdown */}
                {showSuggestions && filteredEvents.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
                    {filteredEvents.map((event: any) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => handleSuggestionClick(event.name)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                      >
                        <p className="font-medium text-gray-900">{event.name}</p>
                        <p className="text-sm text-gray-500">
                          {event.country} • {new Date(event.event_date).toLocaleDateString()}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Form>

            {/* Category Filter Buttons + Sort Dropdown */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { value: "all", label: "All" },
                { value: "room", label: "Hotel" },
                { value: "bib", label: "Bibs" },
                { value: "room_and_bib", label: "Package" },
              ].map((category) => (
                <a
                  key={category.value}
                  href={category.value === "all" ? `/listings${currentSearch ? `?search=${currentSearch}` : ""}` : `/listings?type=${category.value}${currentSearch ? `&search=${currentSearch}` : ""}`}
                  className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                    currentType === category.value
                      ? "bg-brand-500 text-white"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {category.label}
                </a>
              ))}

              {/* Sort Dropdown */}
              <SortDropdown value={sortBy} onChange={setSortBy} />
            </div>
          </div>

          {/* Results */}
{filteredBySort.length > 0 ? (
  <>
    {/* Desktop: Grid di card */}
    <div className="hidden md:grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr relative z-0">
      {visibleListings.map((listing: any) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          isUserLoggedIn={!!user}
          isSaved={(savedListingIds || []).includes(listing.id)}
        />
      ))}
    </div>

    {/* Mobile: Lista verticale compatta */}
    <div className="flex flex-col gap-3 md:hidden relative z-0">
      {visibleListings.map((listing: any) => (
        <ListingCardCompact
          key={listing.id}
          listing={listing}
          isUserLoggedIn={!!user}
          isSaved={(savedListingIds || []).includes(listing.id)}
        />
      ))}
    </div>

    {/* Load More Button */}
    {hasMore && (
      <div className="mt-8 text-center">
        <button
          onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
          className="px-8 py-3 bg-white text-gray-700 font-medium rounded-full border border-gray-300 hover:bg-gray-50 transition-colors shadow-md"
        >
          Load More ({filteredBySort.length - visibleCount} remaining)
        </button>
      </div>
    )}
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

        <FooterLight />
      </div>
    </div>
  );
}
