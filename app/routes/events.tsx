import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams, Form, useNavigate, Link } from "react-router";
import { useState, useRef, useEffect } from "react";
import { useI18n } from "~/hooks/useI18n";
import { getUser } from "~/lib/session.server";
import { supabase, supabaseAdmin } from "~/lib/supabase.server";
import { localizeEvent, localizeListing, resolveLocaleForRequest } from "~/lib/locale";
import { applyListingDisplayCurrency, getCurrencyForCountry } from "~/lib/currency";
import { Header } from "~/components/Header";
import { FooterLight } from "~/components/FooterLight";
import { ListingCard } from "~/components/ListingCard";
import { ListingCardCompact } from "~/components/ListingCardCompact";
import { SortDropdown } from "~/components/SortDropdown";

export const meta: MetaFunction = () => [{ title: "Browse Events - Runoot" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  const locale = resolveLocaleForRequest(request, (user as any)?.preferred_language);
  const viewerCurrency = getCurrencyForCountry((user as any)?.country || null);
  const url = new URL(request.url);
  const search = url.searchParams.get("search");

  const { data: listings, error } = await (supabaseAdmin as any)
    .from("listings")
    .select(
      `
      *,
      author:profiles!listings_author_id_fkey(id, full_name, company_name, user_type, is_verified, avatar_url),
      event:events(id, name, slug, country, event_date, card_image_url)
    `
    )
    .eq("status", "active")
    .eq("listing_mode", "event")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading event listings:", error);
    return { user, listings: [], savedListingIds: [], events: [] };
  }

  let filteredListings = (listings || []).map((listing: any) =>
    applyListingDisplayCurrency(localizeListing(listing, locale), viewerCurrency)
  );
  if (search) {
    const searchLower = search.toLowerCase();
    filteredListings = filteredListings.filter(
      (l: any) =>
        l.event?.name?.toLowerCase().includes(searchLower) ||
        l.event?.country?.toLowerCase().includes(searchLower) ||
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

  const { data: events } = await supabase
    .from("events")
    .select("id, name, country, event_date")
    .order("event_date", { ascending: true });

  const localizedEvents = (events || []).map((event: any) => localizeEvent(event, locale));
  return { user, listings: filteredListings, savedListingIds, events: localizedEvents };
}

export default function EventsPage() {
  const { t } = useI18n();
  const { user, listings, savedListingIds, events } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);

  const currentSearch = searchParams.get("search") || "";
  const currentSort = searchParams.get("sort") || "event_soonest";
  const hasActiveSearch = currentSearch.trim().length > 0;

  const [searchQuery, setSearchQuery] = useState(currentSearch);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sortBy, setSortBy] = useState(currentSort);

  const ITEMS_PER_PAGE = 12;
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [currentSearch, sortBy]);

  const sortedListings = [...(listings as any[])].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "first_posted":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "event_soonest":
        return new Date(a.event?.event_date || 0).getTime() - new Date(b.event?.event_date || 0).getTime();
      case "price_low":
        return (a.price ?? Infinity) - (b.price ?? Infinity);
      case "price_high":
        return (b.price ?? -Infinity) - (a.price ?? -Infinity);
      case "contact_price":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      default:
        return 0;
    }
  });

  const filteredBySort = sortBy === "contact_price" ? sortedListings.filter((l) => l.price == null) : sortedListings;
  const visibleListings = filteredBySort.slice(0, visibleCount);
  const hasMore = visibleCount < filteredBySort.length;

  const filteredEvents = searchQuery.length >= 2
    ? (events as any[])
        .filter(
          (event) =>
            event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            event.country.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 5)
    : [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSuggestionClick = (eventName: string) => {
    setSearchQuery(eventName);
    setShowSuggestions(false);
    navigate(`/events?search=${encodeURIComponent(eventName)}`);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setShowSuggestions(false);
    navigate("/events");
  };

  const eventSortOptions = [
    { value: "newest", label: "Newest" },
    { value: "first_posted", label: "Oldest" },
    { value: "event_soonest", label: "Last minute" },
    { value: "price_low", label: "Price: Low to High" },
    { value: "price_high", label: "Price: High to Low" },
    { value: "contact_price", label: "Contact for price" },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="min-h-screen flex flex-col">
        <Header user={user} />

        <main className="mx-auto max-w-7xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8 flex-grow w-full">
          <div className="mb-4 max-w-2xl rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-brand-100/55 px-4 py-3.5 text-sm text-slate-800 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
                  </svg>
                </span>
                <p className="text-sm font-medium text-slate-700">{t("events.banner_listings_prefix")}</p>
              </div>
              <Link
                to="/listings"
                className="inline-flex items-center rounded-full bg-slate-50 px-4 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
              >
                {t("events.banner_listings_link")}
              </Link>
            </div>
          </div>

          <div className="mb-4 rounded-3xl border border-brand-200/70 bg-gradient-to-r from-white to-brand-100/55 px-5 py-8 shadow-sm sm:px-6 sm:py-10">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 text-center sm:text-left">
              {t("nav.event")}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-600 text-center sm:text-left">
              {t("events.subtitle")}
            </p>
          </div>

          <div className="relative z-10 mb-8">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
              {hasActiveSearch && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  {t("listings.search.placeholder")}: "{currentSearch}"
                </span>
              )}
            </div>

            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
              <Form method="get" className="w-full lg:w-[44%] xl:w-[48%]">
                <div className="relative w-full" ref={searchRef}>
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="search"
                    name="search"
                    autoComplete="off"
                    placeholder={t("listings.search.placeholder")}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    className="block w-full rounded-full border-0 pl-12 pr-24 py-3.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-colors shadow-md ring-1 ring-gray-200"
                  />
                  {hasActiveSearch ? (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-full border border-gray-300 hover:bg-gray-50 transition-all"
                    >
                      {t("listings.cancel_search")}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-accent-500 text-white text-sm font-medium rounded-full hover:bg-accent-600 transition-all"
                    >
                      Search
                    </button>
                  )}

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
                            {event.country} • {new Date(event.event_date).toLocaleDateString()}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Form>

              <div className="shrink-0">
                <SortDropdown value={sortBy} onChange={setSortBy} options={eventSortOptions} />
              </div>
            </div>
            <div className="mt-6 border-t border-slate-300/90" />
          </div>

          {filteredBySort.length > 0 ? (
            <>
              <div className="hidden md:grid gap-6 pt-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr relative z-0">
                {visibleListings.map((listing: any) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    isUserLoggedIn={!!user}
                    isSaved={(savedListingIds || []).includes(listing.id)}
                    currentUserId={(user as any)?.id ?? null}
                    className="border border-slate-300 shadow-[0_12px_26px_rgba(15,23,42,0.18)] hover:shadow-[0_16px_34px_rgba(15,23,42,0.22)]"
                  />
                ))}
              </div>

              <div className="flex flex-col gap-3 pt-2 md:hidden relative z-0">
                {visibleListings.map((listing: any) => (
                  <ListingCardCompact
                    key={listing.id}
                    listing={listing}
                    isUserLoggedIn={!!user}
                    isSaved={(savedListingIds || []).includes(listing.id)}
                    currentUserId={(user as any)?.id ?? null}
                    className="border-slate-300 shadow-[0_10px_20px_rgba(15,23,42,0.14)]"
                  />
                ))}
              </div>

              {hasMore && (
                <div className="mt-8 text-center">
                  <button
                    onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
                    className="px-8 py-3 bg-white text-gray-700 font-medium rounded-full border border-gray-300 hover:bg-gray-50 transition-colors shadow-md"
                  >
                    {t("events.load_more")} ({filteredBySort.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              {hasActiveSearch ? (
                <>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">{t("events.empty_title")}</h3>
                  <p className="mt-2 text-gray-600">{t("events.empty_help")}</p>
                </>
              ) : (
                <>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">{t("events.empty_coming_title")}</h3>
                  <p className="mt-2 text-gray-600">
                    {t("events.empty_coming_help")}{" "}
                    <Link to="/contact?subject=partnership" className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800">
                      {t("events.empty_coming_contact")}
                    </Link>
                    .
                  </p>
                  <div className="mt-6">
                    <Link
                      to="/"
                      className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 transition-colors hover:bg-slate-50"
                    >
                      {t("events.back_home")}
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}
        </main>

        <FooterLight />
      </div>
    </div>
  );
}
