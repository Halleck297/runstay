import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useNavigate, Form } from "react-router";
import { useState, useRef, useEffect } from "react";
import { useI18n } from "~/hooks/useI18n";
import { getUser } from "~/lib/session.server";
import { supabase, supabaseAdmin } from "~/lib/supabase.server";
import { localizeListing, localizeEvent, resolveLocaleForRequest } from "~/lib/locale";
import { Header } from "~/components/Header";
import { FooterLight } from "~/components/FooterLight";
import { ListingCard } from "~/components/ListingCard";
import { ListingCardCompact } from "~/components/ListingCardCompact";

const HERO_ROTATING_WORDS = [
  { subject: "Rooms", subjectColor: "text-brand-200", verb: "Empty" },
  { subject: "Bibs", subjectColor: "text-purple-300", verb: "Wasted" },
];


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
  const locale = resolveLocaleForRequest(request, (user as any)?.preferred_language);

  // Home listings:
  // - authenticated: normal RLS query
  // - anonymous: admin query with sanitized preview fields only
  let listings: any[] = [];
  if (user) {
    const { data } = await supabase
      .from("listings")
      .select(
        `
        *,
        author:profiles!listings_author_id_fkey(id, full_name, company_name, user_type, is_verified),
        event:events(id, name, slug, country, event_date)
      `
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(3);
    listings = (data || []).map((listing: any) => localizeListing(listing, locale));
  } else {
    const { data } = await (supabaseAdmin as any)
      .from("listings")
      .select(
        `
        id,
        listing_type,
        hotel_name,
        hotel_stars,
        hotel_rating,
        room_count,
        room_type,
        bib_count,
        check_in,
        check_out,
        created_at,
        event:events(id, name, slug, country, event_date)
      `
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(3);

    listings = (data || []).map((listing: any) => localizeListing({
      ...listing,
      title: listing.event?.name || "Listing",
      price: null,
      price_negotiable: false,
      transfer_type: null,
      associated_costs: null,
      author: {
        id: "",
        full_name: null,
        company_name: null,
        user_type: "private",
        is_verified: false,
      },
    }, locale));
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
    return { user, listings, savedListingIds, events: localizedEvents };

}

export default function Index() {
    const { t } = useI18n();
    const { user, listings, savedListingIds, events } = useLoaderData<typeof loader>();
    const navigate = useNavigate();
    const searchRef = useRef<HTMLDivElement>(null);

    const [searchQuery, setSearchQuery] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Rotating words for hero title
    const [subjectIndex, setSubjectIndex] = useState(0);
    const [verbIndex, setVerbIndex] = useState(0);
    const [subjectAnimating, setSubjectAnimating] = useState(false);
    const [verbAnimating, setVerbAnimating] = useState(false);
    const words = HERO_ROTATING_WORDS;

    useEffect(() => {
      const interval = setInterval(() => {
        // Prima anima subject (fade out)
        setSubjectAnimating(true);
        setTimeout(() => {
          // Cambia subject e fade in
          setSubjectIndex((prev) => (prev + 1) % words.length);
          setSubjectAnimating(false);
        }, 600);

        // Poi anima verb con delay (fade out)
        setTimeout(() => {
          setVerbAnimating(true);
          setTimeout(() => {
            // Cambia verb e fade in
            setVerbIndex((prev) => (prev + 1) % words.length);
            setVerbAnimating(false);
          }, 600);
        }, 900);
      }, 4000);
      return () => clearInterval(interval);
    }, [words.length]);

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
    // Navigate anon users to login before opening listings
    if (!user) {
      navigate(`/login?redirectTo=${encodeURIComponent(`/listings?search=${eventName}`)}`);
      return;
    }
    navigate(`/listings?search=${encodeURIComponent(eventName)}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/hero.jpg')] bg-cover bg-center" />
          <div className="absolute inset-0 bg-brand-800/70" />
          <div className="relative mx-auto max-w-7xl px-4 py-32 sm:py-40 lg:py-48 sm:px-6 lg:px-8">
            <div className="text-center">
            <h1 className="font-display text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl [text-shadow:0_4px_20px_rgba(0,0,0,0.7)]">
              <span className="block">Don't Let</span>
              <span className="block">
                <span
                  className={`inline-block ${words[subjectIndex].subjectColor} transition-all duration-500 ${
                    subjectAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
                  }`}
                >
                  {words[subjectIndex].subject}
                </span>
              </span>
              <span className="block">Go</span>
              <span className="block">
                <span
                  className={`inline-block text-accent-400 transition-all duration-500 ${
                    verbAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
                  }`}
                >
                  {words[verbIndex].verb}
                </span>
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-xl sm:text-2xl text-white [text-shadow:0_4px_16px_rgba(0,0,0,0.6)]">
              <span className="font-bold">{t("home.hero.subtitle1")}</span>
              <br />
              {t("home.hero.subtitle2")}
            </p>

            {/* Search Bar */}
            <div className="mt-10 mx-auto max-w-xl">
              <Form method="get" action={user ? "/listings" : "/login"} className="flex flex-col items-center gap-8">
                {!user && (
                  <input type="hidden" name="redirectTo" value="/listings" />
                )}
                <div className="relative w-full" ref={searchRef}>
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
                    name="search"
                    autoComplete="off"
                    placeholder={t("home.search.placeholder")}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    className="block w-full rounded-full border-0 pl-12 pr-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 transition-colors"
                    style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' }}
                  />

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
                <button
                  type="submit"
                  className="px-8 py-3 bg-accent-500 text-white font-medium rounded-full hover:bg-accent-600 transition-all shadow-lg shadow-accent-500/30"
                >
                  Search
                </button>
              </Form>
            </div>

            </div>
          </div>
        </section>


        {/* Recent Listings */}
        {listings.length > 0 && (
          <section className="pt-8 pb-20 md:py-20 bg-gray-50">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row items-center justify-between">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 text-center md:text-left">
                  {t("home.recent_listings")}
                </h2>
                {/* View all - hidden on mobile, shown in header on desktop */}
                <Link
                  to={user ? "/listings" : "/login"}
                  className="hidden md:inline-block px-6 py-2 bg-brand-500 text-white font-medium rounded-full hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/30"
                >
                  {t("home.view_all")}
                </Link>
              </div>

              {/* Desktop: Grid di card */}
              <div className="mt-8 hidden md:grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {listings.map((listing: any) => (
                  <ListingCard key={listing.id} listing={listing} isUserLoggedIn={!!user} isSaved={(savedListingIds || []).includes(listing.id)} />
                ))}
              </div>

              {/* Mobile: Lista verticale compatta */}
              <div className="mt-6 flex flex-col gap-3 md:hidden">
                {listings.map((listing: any) => (
                  <ListingCardCompact key={listing.id} listing={listing} isUserLoggedIn={!!user} isSaved={(savedListingIds || []).includes(listing.id)} />
                ))}
              </div>

              {/* Mobile: View all button centered below cards */}
              <div className="mt-4 flex justify-center md:hidden">
                <Link
                  to={user ? "/listings" : "/login"}
                  className="px-6 py-2 bg-brand-500 text-white font-medium rounded-full hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/30"
                >
                  {t("home.view_all")}
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>


      <FooterLight />
    </div>
  );
}
