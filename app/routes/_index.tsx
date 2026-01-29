import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useNavigate, Form } from "react-router";
import { useState, useRef, useEffect } from "react";
import { getUser } from "~/lib/session.server";
import { supabase, supabaseAdmin } from "~/lib/supabase.server";
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
      event:events(id, name, slug, country, event_date)
    `
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(3);
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

    return { user, listings: listings || [], savedListingIds, events: events || [] };

}

export default function Index() {
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
    const words = [
      { subject: "Rooms", subjectColor: "text-brand-200", verb: "Empty" },
      { subject: "Bibs", subjectColor: "text-purple-300", verb: "Wasted" },
    ];

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
    }, []);

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
      // Navigate to listings with the selected event name as search
      navigate(`/listings?search=${encodeURIComponent(eventName)}`);
    };

  return (
    <div className="min-h-full">
      <Header user={user} />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/hero.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-brand-800/70" />
        <div className="relative mx-auto max-w-7xl px-4 py-32 sm:py-40 lg:py-48 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="font-display text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl [text-shadow:0_4px_20px_rgba(0,0,0,0.7)]">
              Don't Let{" "}
              <span className="inline-block w-[140px] sm:w-[175px] lg:w-[210px] text-left">
                <span
                  className={`inline-block ${words[subjectIndex].subjectColor} transition-all duration-500 ${
                    subjectAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
                  }`}
                >
                  {words[subjectIndex].subject}
                </span>
              </span>
              <span className="block">
                Go{" "}
                <span className="inline-block w-[145px] sm:w-[185px] lg:w-[225px] text-left">
                  <span
                    className={`inline-block text-accent-400 transition-all duration-500 ${
                      verbAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
                    }`}
                  >
                    {words[verbIndex].verb}
                  </span>
                </span>
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-xl sm:text-2xl text-white [text-shadow:0_4px_16px_rgba(0,0,0,0.6)]">
              <span className="font-bold">Your race, your community.</span>
              <br />
              Exchange rooms and bibs directly with runners like you.
            </p>

            {/* Search Bar */}
            <div className="mt-10 mx-auto max-w-xl">
              <Form method="get" action="/listings" className="flex items-center gap-3">
                <div className="relative flex-1" ref={searchRef}>
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
                    placeholder="Search by event name or location..."
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
                  className="px-6 py-3 bg-accent-500 text-white font-medium rounded-full hover:bg-accent-600 transition-all shadow-lg shadow-accent-500/30"
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
  <section className="py-20 bg-gray-50">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-3xl font-bold text-gray-900">
          Recent Listings
        </h2>
        <Link
          to={user ? "/listings" : "/login"}
          className="px-6 py-2 bg-brand-500 text-white font-medium rounded-full hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/30"
        >
          View all
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
          <div className="mt-4 flex justify-center gap-6 text-sm text-gray-500">
            <Link to="/privacy-policy" className="hover:text-gray-300 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/cookie-policy" className="hover:text-gray-300 transition-colors">
              Cookie Policy
            </Link>
            <Link to="/terms" className="hover:text-gray-300 transition-colors">
              Terms & Conditions
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
