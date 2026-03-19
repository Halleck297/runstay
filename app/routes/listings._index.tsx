import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams, Form, useNavigate, Link, useFetcher } from "react-router";
import { useState, useRef, useEffect } from "react";
import { useI18n } from "~/hooks/useI18n";
import { getUser } from "~/lib/session.server";
import { supabase, supabaseAdmin } from "~/lib/supabase.server";
import { localizeEvent, localizeListing, resolveLocaleForRequest } from "~/lib/locale";
import { applyListingDisplayCurrency, getCurrencyForCountry } from "~/lib/currency";
import type { ListingType } from "~/lib/database.types";
import { Header } from "~/components/Header";
import { FooterLight } from "~/components/FooterLight";
import { ListingCard } from "~/components/ListingCard";
import { ListingCardCompact } from "~/components/ListingCardCompact";
import { SortDropdown } from "~/components/SortDropdown";
import { analyticsEvents } from "~/lib/analytics/events";
import { trackEvent } from "~/lib/analytics/client";
import { isEventExpired } from "~/lib/listing-status";


export const meta: MetaFunction = () => {
  return [{ title: "Browse Listings - Runoot" }];
};

const PAGE_SIZE = 12;

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  const locale = resolveLocaleForRequest(request, (user as any)?.preferred_language);
  const viewerCurrency = getCurrencyForCountry((user as any)?.country || null);
  const url = new URL(request.url);

  const type = url.searchParams.get("type");
  const search = url.searchParams.get("search");
  const sort = url.searchParams.get("sort") || "newest";
  const page = Math.max(0, parseInt(url.searchParams.get("page") || "0", 10));

  let query = (supabaseAdmin as any)
    .from("listings")
    .select(
      `
      *,
      author:profiles!listings_author_id_fkey(id, full_name, company_name, user_type, is_verified, avatar_url),
      event:events(id, name, name_i18n, slug, country, country_i18n, event_date, card_image_url)
    `,
      { count: "exact" }
    )
    .eq("status", "active")
    .eq("listing_mode", "exchange");

  // Type filter
  if (type && type !== "all") {
    const allowedTypes: ListingType[] = ["room", "bib", "room_and_bib"];
    if (allowedTypes.includes(type as ListingType)) {
      query = query.eq("listing_type", type as ListingType);
    }
  }

  // Search filter server-side
  if (search) {
    const { data: matchingEvents } = await supabase
      .from("events")
      .select("id")
      .or(`name.ilike.%${search}%,country.ilike.%${search}%`);
    const eventIds = (matchingEvents || []).map((e: any) => e.id);
    if (eventIds.length > 0) {
      query = query.or(`title.ilike.%${search}%,event_id.in.(${eventIds.join(",")})`);
    } else {
      query = query.ilike("title", `%${search}%`);
    }
  }

  // Sort server-side
  switch (sort) {
    case "first_posted":
      query = query.order("created_at", { ascending: true });
      break;
    case "price_low":
      query = query.order("price", { ascending: true, nullsFirst: false });
      break;
    case "price_high":
      query = query.order("price", { ascending: false, nullsFirst: false });
      break;
    case "contact_price":
      query = query.is("price", null).order("created_at", { ascending: false });
      break;
    default: // "newest" and event_soonest fallback
      query = query.order("created_at", { ascending: false });
  }

  // Pagination
  query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  const { data: listings, error, count } = await query;

  if (error) {
    console.error("Error loading listings:", error);
    return { user, listings: [], totalCount: 0, page, sort, search: search || "" };
  }

  const processedListings = (listings || []).map((listing: any) =>
    applyListingDisplayCurrency(localizeListing(listing, locale), viewerCurrency)
  );

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
    .select("id, name, name_i18n, country, country_i18n, event_date")
    .order("event_date", { ascending: true });

  const localizedEvents = (events || []).map((event: any) => localizeEvent(event, locale));

  return {
    user,
    listings: processedListings,
    savedListingIds,
    events: localizedEvents,
    totalCount: count || 0,
    page,
    sort,
    search: search || "",
  };
}

export default function Listings() {
  const { t, locale } = useI18n();
  const { user, listings, savedListingIds, events, totalCount, page } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fetcher = useFetcher<typeof loader>();
  const searchRef = useRef<HTMLDivElement>(null);

  const currentType = searchParams.get("type") || "all";
  const currentSearch = searchParams.get("search") || "";
  const currentSort = searchParams.get("sort") || "newest";
  const hasActiveSearch = currentSearch.trim().length > 0;
  const hasEvents = (events as any[]).length > 0;

  const [searchQuery, setSearchQuery] = useState(currentSearch);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sortBy, setSortBy] = useState(currentSort);

  // Accumulated listings across "Load More" pages
  const [extraListings, setExtraListings] = useState<any[]>([]);

  // Reset accumulated pages when filters/sort change
  useEffect(() => {
    setExtraListings([]);
  }, [currentType, currentSearch, currentSort]);

  // Append fetched page to accumulated list
  useEffect(() => {
    if (fetcher.data?.listings) {
      setExtraListings((prev) => [...prev, ...(fetcher.data!.listings as any[])]);
    }
  }, [fetcher.data]);

  const formatEventDate = (rawDate: string) => {
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate || "");
    if (dateOnlyMatch) {
      const yyyy = Number(dateOnlyMatch[1]);
      const mm = Number(dateOnlyMatch[2]) - 1;
      const dd = Number(dateOnlyMatch[3]);
      return new Intl.DateTimeFormat(locale, { timeZone: "UTC" }).format(new Date(Date.UTC(yyyy, mm, dd)));
    }
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return rawDate;
    return new Intl.DateTimeFormat(locale, { timeZone: "UTC" }).format(parsed);
  };

  // Expired split (client-side on the already-loaded subset)
  const allLoaded = [...(listings as any[]), ...extraListings];
  const nonExpiredListings = allLoaded.filter((l: any) => !isEventExpired(l.event?.event_date || ""));
  const expiredListings = allLoaded.filter((l: any) => isEventExpired(l.event?.event_date || ""));
  const visibleListings = [...nonExpiredListings, ...expiredListings];

  const loadedCount = allLoaded.length;
  const nextPage = page + 1 + Math.floor(extraListings.length / PAGE_SIZE);
  const hasMore = loadedCount < totalCount;

  const handleLoadMore = () => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    fetcher.load(`/listings?${params.toString()}`);
  };

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
    trackEvent(analyticsEvents.LISTINGS_SEARCH_SUGGESTION_CLICKED, {
      event_name: eventName,
      type_filter: currentType,
    });
    setSearchQuery(eventName);
    setShowSuggestions(false);
    // Navigate with the selected event name as search
    const params = new URLSearchParams();
    if (currentType !== "all") params.set("type", currentType);
    params.set("search", eventName);
    navigate(`/listings?${params.toString()}`);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setShowSuggestions(false);

    const params = new URLSearchParams();
    if (currentType !== "all") params.set("type", currentType);

    const nextQuery = params.toString();
    navigate(nextQuery ? `/listings?${nextQuery}` : "/listings");
  };

  const handleSortChange = (nextSort: string) => {
    setSortBy(nextSort);
    trackEvent(analyticsEvents.LISTINGS_SORT_CHANGED, {
      from: sortBy,
      to: nextSort,
      type_filter: currentType,
      has_search: hasActiveSearch,
    });
    // Navigate to apply sort server-side
    const params = new URLSearchParams(searchParams);
    params.set("sort", nextSort);
    params.delete("page");
    navigate(`/listings?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[#ECF4FE]">
      <div className="min-h-screen flex flex-col">
        <Header user={user} />

        <main className="mx-auto max-w-7xl px-4 pt-6 pb-14 md:pt-16 md:pb-8 sm:px-6 lg:px-8 flex-grow w-full">
          <div className="mb-6">
            <div className="rounded-3xl border border-brand-500 bg-white px-4 py-4 opacity-100 md:mx-auto md:max-w-4xl md:px-6 md:py-5" style={{ backgroundColor: "#ffffff" }}>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 text-center underline decoration-accent-500 underline-offset-4">
                {t("listings.title")}
              </h1>
              <p className="mt-2 text-sm sm:text-base text-gray-600 text-center">
                {t("listings.subtitle")}
              </p>
            </div>
          </div>

          <div className="relative z-10 mb-8">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
              {hasActiveSearch && (
                <span className="rounded-full bg-slate-50 px-3 py-1 text-slate-700">
                  {t("listings.search.placeholder")}: "{currentSearch}"
                </span>
              )}
            </div>

            <div className="flex flex-col gap-4 max-[390px]:gap-3 lg:flex-row lg:items-center lg:gap-8">
              {/* Search Bar with Autocomplete */}
              <Form
                method="get"
                name="listing-search"
                onSubmit={() =>
                  trackEvent(analyticsEvents.LISTINGS_SEARCH_SUBMITTED, {
                    query: searchQuery.trim(),
                    type_filter: currentType,
                  })
                }
                className="w-full lg:w-[44%] xl:w-[48%]"
              >
                <input type="hidden" name="type" value={currentType} />
                <div className="relative w-full rounded-full bg-white" ref={searchRef}>
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
                    className="block w-full appearance-none rounded-full border border-accent-500 bg-white pl-12 pr-20 py-3.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-colors shadow-none max-[390px]:pr-16 max-[390px]:py-3"
                    style={{ backgroundColor: "#ffffff" }}
                  />
                  {hasActiveSearch ? (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-2 text-xs bg-white text-gray-700 font-medium rounded-full border border-gray-300 hover:bg-gray-50 transition-all sm:px-4 sm:py-2.5 sm:text-sm max-[390px]:px-2.5 max-[390px]:text-[11px]"
                    >
                      {t("listings.cancel_search")}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-2 text-xs bg-accent-500 text-white font-medium rounded-full hover:bg-accent-600 transition-all sm:px-5 sm:py-2.5 sm:text-sm max-[390px]:px-2.5 max-[390px]:text-[11px]"
                    >
                      Search
                    </button>
                  )}

                  {/* Autocomplete Dropdown */}
                  {showSuggestions && filteredEvents.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 z-20 overflow-hidden">
                      {filteredEvents.map((event: any) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => handleSuggestionClick(event.name)}
                          className="w-full px-4 py-3.5 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <p className="font-medium text-gray-900">{event.name}</p>
                          <p className="text-sm text-gray-500">
                            {event.country} • {formatEventDate(event.event_date)}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Form>

              {/* Category Filter Buttons + Sort Dropdown */}
              <div className="flex w-full flex-col gap-3 max-[390px]:gap-2.5 lg:ml-auto lg:w-auto lg:flex-row lg:items-center lg:gap-2.5">
                <div className="overflow-x-auto pb-1 lg:overflow-visible lg:pb-0">
                  <div className="flex w-full items-center justify-end gap-2.5 min-w-max max-[390px]:gap-2">
                    {[
                      { value: "all", label: "All" },
                      { value: "room", label: "Hotel" },
                      { value: "bib", label: t("common.bibs") },
                      { value: "room_and_bib", label: "Package" },
                    ].map((category) => (
                      <a
                        key={category.value}
                        href={category.value === "all" ? `/listings${currentSearch ? `?search=${currentSearch}` : ""}` : `/listings?type=${category.value}${currentSearch ? `&search=${currentSearch}` : ""}`}
                        className={`px-3.5 py-2.5 sm:px-4 rounded-full text-sm font-bold uppercase tracking-wide transition-colors whitespace-nowrap max-[390px]:px-2.5 max-[390px]:py-2 max-[390px]:text-[11px] max-[390px]:tracking-normal ${
                          currentType === category.value
                            ? "bg-brand-500 text-white shadow-sm"
                            : category.value === "all"
                              ? "bg-white text-brand-500 border border-gray-300 hover:bg-gray-50"
                              : "bg-white text-brand-500 border border-brand-500 hover:bg-gray-50"
                        }`}
                      >
                        {category.label}
                      </a>
                    ))}
                  </div>
                </div>

                <div className="flex w-full flex-wrap items-center justify-end gap-2.5 sm:gap-3 lg:w-auto lg:flex-nowrap">
                  {hasEvents && (
                    <Link
                      to="/events"
                      className="shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 bg-white text-gray-700 text-sm font-medium uppercase tracking-wide rounded-full border border-gray-300 hover:bg-gray-50 transition-colors whitespace-nowrap md:hidden max-[390px]:px-2.5 max-[390px]:py-2 max-[390px]:text-[11px] max-[390px]:tracking-normal"
                    >
                      <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
                      </svg>
                      <span>Events</span>
                    </Link>
                  )}

                  <div className="shrink-0 max-[390px]:origin-left max-[390px]:scale-95">
                    <SortDropdown value={sortBy} onChange={handleSortChange} buttonClassName="!border-accent-500" />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 border-t border-slate-300/90" />
          </div>

          {/* Results */}
{visibleListings.length > 0 ? (
  <>
    {/* Desktop: Grid di card */}
    <div className="hidden md:grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 auto-rows-fr relative z-0">
      {visibleListings.map((listing: any) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          isUserLoggedIn={!!user}
          isSaved={(savedListingIds || []).includes(listing.id)}
          currentUserId={(user as any)?.id ?? null}
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
          currentUserId={(user as any)?.id ?? null}
        />
      ))}
    </div>

    {/* Load More Button */}
    {hasMore && (
      <div className="mt-8 text-center">
        <button
          onClick={handleLoadMore}
          disabled={fetcher.state === "loading"}
          className="px-8 py-3 bg-white text-gray-700 font-medium rounded-full border border-gray-300 hover:bg-gray-50 transition-colors shadow-md disabled:opacity-50"
        >
          {fetcher.state === "loading"
            ? "Loading..."
            : `Load More (${totalCount - loadedCount} remaining)`}
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
