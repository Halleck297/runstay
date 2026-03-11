import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { Link, useLoaderData, useNavigate, Form } from "react-router";
import { useMemo, useState, useRef, useEffect } from "react";
import { useI18n } from "~/hooks/useI18n";
import { getUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { localizeListing, resolveLocaleForRequest } from "~/lib/locale";
import { applyListingDisplayCurrency, getCurrencyForCountry } from "~/lib/currency";
import { Header } from "~/components/Header";
import { FooterLight } from "~/components/FooterLight";
import { ListingCard } from "~/components/ListingCard";
import { ListingCardCompact } from "~/components/ListingCardCompact";
import { analyticsEvents } from "~/lib/analytics/events";
import { trackEvent } from "~/lib/analytics/client";

type HomeEventSuggestion = {
  id: string;
  name: string;
  country: string;
  event_date: string;
};

export const meta: MetaFunction = () => {
  return [
    { title: "runoot | running exchange platform" },
    {
      name: "description",
      content:
        "runoot is a private platform where runners exchange hotel bookings and race bibs when plans change, so they don't go to waste.",
    },
    { tagName: "link", rel: "canonical", href: "https://www.runoot.com/en" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  const locale = resolveLocaleForRequest(request, (user as any)?.preferred_language);
  const viewerCurrency = getCurrencyForCountry((user as any)?.country || null);
  const userAgent = request.headers.get("user-agent") || "";
  const preferCompactCards = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(userAgent);

  const listingSelect = `
      *,
      author:profiles!listings_author_id_fkey(id, full_name, company_name, user_type, is_verified, avatar_url),
      event:events(id, name, name_i18n, slug, country, country_i18n, event_date, card_image_url)
    `;

  const [homeListingsResult, homeEventListingsResult, savedListingsResult] = await Promise.all([
    (supabaseAdmin as any)
      .from("listings")
      .select(listingSelect)
      .eq("status", "active")
      .eq("listing_mode", "exchange")
      .order("created_at", { ascending: false })
      .limit(3),
    (supabaseAdmin as any)
      .from("listings")
      .select(listingSelect)
      .eq("status", "active")
      .eq("listing_mode", "event")
      .order("created_at", { ascending: false })
      .limit(4),
    user
      ? (supabaseAdmin as any)
          .from("saved_listings")
          .select("listing_id")
          .eq("user_id", (user as any).id)
      : Promise.resolve({ data: [] as Array<{ listing_id: string }> }),
  ]);

  const listings = (homeListingsResult.data || []).map((listing: any) =>
    applyListingDisplayCurrency(localizeListing(listing, locale), viewerCurrency)
  );

  const eventListings = (homeEventListingsResult.data || []).map((listing: any) =>
    applyListingDisplayCurrency(localizeListing(listing, locale), viewerCurrency)
  );

  const savedListingIds = (savedListingsResult.data || []).map((s: any) => s.listing_id);

  const cacheControl = user
    ? "private, no-store"
    : "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

  return data(
    { user, listings, eventListings, savedListingIds, preferCompactCards },
    {
      headers: {
        "Cache-Control": cacheControl,
      },
    }
  );

}

export default function Index() {
    const { t } = useI18n();
    const loaderData = useLoaderData<typeof loader>() as {
      user?: any;
      listings?: any[];
      eventListings?: any[];
      savedListingIds?: string[];
      preferCompactCards?: boolean;
    };
    const user = loaderData.user ?? null;
    const listings = loaderData.listings ?? [];
    const eventListings = loaderData.eventListings ?? [];
    const savedListingIds = loaderData.savedListingIds ?? [];
    const preferCompactCards = loaderData.preferCompactCards ?? false;
    const navigate = useNavigate();
    const searchRef = useRef<HTMLDivElement>(null);
    const organizationJsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "runoot",
      url: "https://www.runoot.com",
      logo: "https://www.runoot.com/logo.svg",
    });

    const [searchQuery, setSearchQuery] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [eventSuggestions, setEventSuggestions] = useState<HomeEventSuggestion[]>([]);

    // Rotating words for hero title
    const [subjectIndex, setSubjectIndex] = useState(0);
    const [verbIndex, setVerbIndex] = useState(0);
    const [subjectAnimating, setSubjectAnimating] = useState(false);
    const [verbAnimating, setVerbAnimating] = useState(false);
    const visibleEventListings = (eventListings as any[]).slice(0, 3);
    const hasMoreEventListings = (eventListings as any[]).length > 3;
    const words = useMemo(
      () => [
        { subject: t("home.hero.word.rooms"), subjectColor: "text-brand-200", verb: t("home.hero.word.empty") },
        { subject: t("home.hero.word.bibs"), subjectColor: "text-purple-300", verb: t("home.hero.word.wasted") },
      ],
      [t]
    );

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

    // Fetch event suggestions on-demand to keep SSR home payload light.
    useEffect(() => {
      const query = searchQuery.trim();
      if (query.length < 2) {
        setEventSuggestions([]);
        return;
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(async () => {
        try {
          const response = await fetch(`/api/events/search?q=${encodeURIComponent(query)}`, {
            signal: controller.signal,
            credentials: "same-origin",
          });
          if (!response.ok) {
            setEventSuggestions([]);
            return;
          }
          const payload = (await response.json()) as { events?: HomeEventSuggestion[] };
          setEventSuggestions(payload.events || []);
        } catch {
          if (!controller.signal.aborted) {
            setEventSuggestions([]);
          }
        }
      }, 220);

      return () => {
        controller.abort();
        window.clearTimeout(timeoutId);
      };
    }, [searchQuery]);

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
    trackEvent(analyticsEvents.HOME_SEARCH_SUGGESTION_CLICKED, {
      event_name: eventName,
      authenticated: !!user,
    });
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: organizationJsonLd }}
      />
      <Header user={user} isHome />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <picture className="absolute inset-0" aria-hidden="true">
            <source media="(max-width: 767px)" srcSet="/hero-mobile.webp" type="image/webp" />
            <img
              src="/hero.webp"
              alt=""
              fetchPriority="high"
              loading="eager"
              decoding="async"
              className="h-full w-full object-cover object-top"
            />
          </picture>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative mx-auto max-w-7xl px-4 pt-12 pb-36 sm:py-44 lg:py-52 sm:px-6 lg:px-8">
            <div className="text-center">
            <h1 className="font-display text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl [text-shadow:0_4px_20px_rgba(0,0,0,0.7)]">
              <span className="block">{t("home.hero.title.top")}</span>
              <span className="block">
                <span
                  className={`inline-block ${words[subjectIndex].subjectColor} transition-all duration-500 ${
                    subjectAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
                  }`}
                >
                  {words[subjectIndex].subject}
                </span>
              </span>
              <span className="block">{t("home.hero.title.middle")}</span>
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
            <p className="mx-auto mt-6 translate-y-6 md:translate-y-8 max-w-2xl text-xl sm:text-2xl text-white [text-shadow:0_4px_16px_rgba(0,0,0,0.6)]">
              <span className="font-bold">{t("home.hero.subtitle1")}</span>
              <br />
              {t("home.hero.subtitle2")}
            </p>
            </div>
          </div>
        </section>

        {/* Search Banner */}
        <section className="relative z-20 h-0 -mt-16 md:-mt-10 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Form
              method="get"
              action={user ? "/listings" : "/login"}
              onSubmit={() =>
                trackEvent(analyticsEvents.HOME_SEARCH_SUBMITTED, {
                  query: searchQuery.trim(),
                  authenticated: !!user,
                })
              }
              className="mx-auto w-full max-w-3xl rounded-3xl md:rounded-full bg-white px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.18)]"
            >
              {!user && <input type="hidden" name="redirectTo" value="/listings" />}
              <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:gap-4">
                <div className="relative min-w-0 flex-1 rounded-full bg-[#ECF4FE] px-4 py-1" ref={searchRef}>
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
                    className="block w-full border-0 bg-transparent px-1 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none"
                  />

                  {showSuggestions && eventSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-200 z-20 overflow-hidden">
                      {eventSuggestions.map((event) => (
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
                  className="w-full shrink-0 rounded-full bg-accent-500 px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-white hover:bg-accent-600 transition-colors md:w-auto"
                >
                  Search
                </button>
              </div>
            </Form>
          </div>
        </section>


        {/* Recent Listings */}
        {listings.length > 0 && (
          <section className="pt-36 pb-20 md:pt-28 md:pb-20 bg-[#ECF4FE]">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-center">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 text-center">
                  {t("home.recent_listings")}
                </h2>
              </div>

              {preferCompactCards ? (
                <div className="mt-6 flex flex-col gap-3">
                  {listings.map((listing: any) => (
                    <ListingCardCompact key={listing.id} listing={listing} isUserLoggedIn={!!user} isSaved={(savedListingIds || []).includes(listing.id)} currentUserId={(user as any)?.id ?? null} />
                  ))}
                </div>
              ) : (
                <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {listings.map((listing: any) => (
                    <ListingCard key={listing.id} listing={listing} isUserLoggedIn={!!user} isSaved={(savedListingIds || []).includes(listing.id)} currentUserId={(user as any)?.id ?? null} />
                  ))}
                </div>
              )}
              <div className="mt-6 flex justify-center">
                <Link
                  to={user ? "/listings" : "/login"}
                  onClick={() =>
                    trackEvent(analyticsEvents.HOME_VIEW_ALL_LISTINGS_CLICKED, {
                      authenticated: !!user,
                    })
                  }
                  className="px-6 py-2.5 bg-brand-500 text-white text-sm font-semibold uppercase tracking-wide rounded-full hover:bg-brand-600 transition-all"
                >
                  {t("home.view_all")}
                </Link>
              </div>

            </div>
          </section>
        )}
        {eventListings.length > 0 && (
          <section className="pb-20 md:pb-24 bg-[#ECF4FE]">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-center">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 text-center">
                  {t("nav.event")}
                </h2>
              </div>
              {preferCompactCards ? (
                <div className="mt-6 flex flex-col gap-3">
                  {visibleEventListings.map((listing: any) => (
                    <ListingCardCompact
                      key={listing.id}
                      listing={listing}
                      isUserLoggedIn={!!user}
                      isSaved={(savedListingIds || []).includes(listing.id)}
                      currentUserId={(user as any)?.id ?? null}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {visibleEventListings.map((listing: any) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      isUserLoggedIn={!!user}
                      isSaved={(savedListingIds || []).includes(listing.id)}
                      currentUserId={(user as any)?.id ?? null}
                    />
                  ))}
                </div>
              )}
              {hasMoreEventListings && (
                <div className="mt-6 flex justify-center">
                  <Link
                    to={user ? "/events" : "/login"}
                    onClick={() =>
                      trackEvent(analyticsEvents.HOME_VIEW_ALL_EVENTS_CLICKED, {
                        authenticated: !!user,
                      })
                    }
                    className="px-6 py-2.5 bg-brand-500 text-white text-sm font-semibold uppercase tracking-wide rounded-full hover:bg-brand-600 transition-all"
                  >
                    {t("home.view_all")}
                  </Link>
                </div>
              )}
            </div>
          </section>
        )}
      </main>


      <FooterLight />
    </div>
  );
}
