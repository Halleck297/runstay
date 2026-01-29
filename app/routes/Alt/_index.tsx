import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
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

  let savedListingIds: string[] = [];
  if (user) {
    const { data: savedListings } = await (supabaseAdmin as any)
      .from("saved_listings")
      .select("listing_id")
      .eq("user_id", (user as any).id);

    savedListingIds = savedListings?.map((s: any) => s.listing_id) || [];
  }

  return { user, listings: listings || [], savedListingIds };
}

export default function Index() {
  const { user, listings, savedListingIds } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-stone-50">
      <Header user={user} />

      {/* Hero Section - Bold & Dynamic */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-800 to-emerald-900">
          {/* Geometric Pattern Overlay */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
          {/* Gradient Orbs */}
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-sm text-emerald-300 font-medium tracking-wide">
                  Live Marketplace
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1]">
                Don't Let
                <span className="block mt-2 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                  Rooms Go Empty
                </span>
              </h1>

              {/* Description */}
              <p className="text-xl text-stone-300 leading-relaxed max-w-xl">
                The smart marketplace where tour operators and runners exchange 
                unsold hotel rooms and marathon bibs. Turn last-minute 
                cancellations into opportunities.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link
                  to="/listings"
                  className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-stone-900 font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5"
                >
                  <span>Browse Listings</span>
                  <svg
                    className="w-5 h-5 transition-transform group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </Link>
                {!user && (
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl border border-white/10 hover:border-white/20 transition-all duration-300 backdrop-blur-sm"
                  >
                    Create Account
                  </Link>
                )}
              </div>

              {/* Trust Indicators */}
              <div className="flex items-center gap-8 pt-8 border-t border-white/10">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">500+</div>
                  <div className="text-sm text-stone-400">Active Listings</div>
                </div>
                <div className="w-px h-12 bg-white/10" />
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">2.5k</div>
                  <div className="text-sm text-stone-400">Happy Users</div>
                </div>
                <div className="w-px h-12 bg-white/10" />
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">98%</div>
                  <div className="text-sm text-stone-400">Success Rate</div>
                </div>
              </div>
            </div>

            {/* Right Visual - Feature Cards */}
            <div className="hidden lg:block relative">
              {/* Floating Cards */}
              <div className="relative h-[500px]">
                {/* Card 1 - Room */}
                <div className="absolute top-0 right-0 w-72 p-6 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-white font-semibold">Hotel Room</div>
                      <div className="text-emerald-300 text-sm">Milan Marathon</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-400">Check-in</span>
                      <span className="text-white">Apr 5, 2025</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-400">Nights</span>
                      <span className="text-white">2 nights</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-400">Price</span>
                      <span className="text-emerald-400 font-semibold">€180</span>
                    </div>
                  </div>
                </div>

                {/* Card 2 - Bib */}
                <div className="absolute top-32 left-0 w-64 p-5 bg-gradient-to-br from-orange-500/20 to-red-500/20 backdrop-blur-xl rounded-2xl border border-orange-400/30 shadow-2xl transform -rotate-6 hover:rotate-0 transition-transform duration-500">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-white font-semibold text-sm">Marathon Bib</div>
                      <div className="text-orange-300 text-xs">NYC Marathon</div>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-orange-500/30 rounded-full">
                    <span className="text-orange-200 text-xs font-medium">Available</span>
                  </div>
                </div>

                {/* Card 3 - Notification */}
                <div className="absolute bottom-20 right-12 w-56 p-4 bg-white rounded-xl shadow-2xl transform rotate-2 hover:rotate-0 transition-transform duration-500">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-stone-900 font-medium text-sm">Deal Confirmed!</div>
                      <div className="text-stone-500 text-xs mt-0.5">Your room has been booked</div>
                    </div>
                  </div>
                </div>

                {/* Decorative Circle */}
                <div className="absolute bottom-0 left-20 w-32 h-32 border-2 border-dashed border-emerald-500/20 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/50">
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <div className="w-5 h-8 rounded-full border-2 border-white/20 flex justify-center pt-1">
            <div className="w-1 h-2 bg-white/50 rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100 mb-6">
              <span className="text-sm text-emerald-700 font-medium">Simple Process</span>
            </div>
            <h2 className="text-4xl font-bold text-stone-900 tracking-tight">
              How Runoot Works
            </h2>
            <p className="mt-4 text-lg text-stone-600">
              Three simple steps to turn your unused bookings into value
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative p-8">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/25 mb-6">
                  1
                </div>
                <h3 className="text-xl font-bold text-stone-900 mb-3">
                  List Your Offer
                </h3>
                <p className="text-stone-600 leading-relaxed">
                  Post your unused hotel room or marathon bib with all the details. Set your price and preferences.
                </p>
              </div>
              {/* Connector Line */}
              <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-emerald-200 to-transparent" />
            </div>

            {/* Step 2 */}
            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative p-8">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/25 mb-6">
                  2
                </div>
                <h3 className="text-xl font-bold text-stone-900 mb-3">
                  Connect & Negotiate
                </h3>
                <p className="text-stone-600 leading-relaxed">
                  Receive inquiries from interested parties. Chat directly and agree on terms.
                </p>
              </div>
              {/* Connector Line */}
              <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-blue-200 to-transparent" />
            </div>

            {/* Step 3 */}
            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative p-8">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-orange-500/25 mb-6">
                  3
                </div>
                <h3 className="text-xl font-bold text-stone-900 mb-3">
                  Complete the Deal
                </h3>
                <p className="text-stone-600 leading-relaxed">
                  Finalize the exchange and transfer the booking. Both parties win!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Listings */}
      {listings.length > 0 && (
        <section className="py-24 bg-stone-50">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-stone-100 border border-stone-200 mb-4">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-sm text-stone-600 font-medium">Fresh Opportunities</span>
                </div>
                <h2 className="text-4xl font-bold text-stone-900 tracking-tight">
                  Recent Listings
                </h2>
                <p className="mt-2 text-lg text-stone-600">
                  The latest rooms and bibs available for exchange
                </p>
              </div>
              <Link
                to={user ? "/listings" : "/login"}
                className="group inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-semibold transition-colors"
              >
                View all listings
                <svg
                  className="w-5 h-5 transition-transform group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </Link>
            </div>

            {/* Desktop: Grid */}
            <div className="hidden md:grid gap-8 md:grid-cols-2 lg:grid-cols-3">
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
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100 mb-6">
                <span className="text-sm text-emerald-700 font-medium">Why Choose Us</span>
              </div>
              <h2 className="text-4xl font-bold text-stone-900 tracking-tight mb-6">
                Built for Runners
                <span className="block text-emerald-600">& Tour Operators</span>
              </h2>
              <p className="text-lg text-stone-600 mb-8">
                We understand the unique challenges of the running events industry. 
                Our platform is designed specifically to address your needs.
              </p>

              <div className="space-y-6">
                {[
                  {
                    icon: (
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    ),
                    title: "Verified Users",
                    description: "All tour operators are verified to ensure safe transactions"
                  },
                  {
                    icon: (
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    ),
                    title: "Direct Messaging",
                    description: "Chat directly with sellers to negotiate and ask questions"
                  },
                  {
                    icon: (
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    ),
                    title: "Real-time Updates",
                    description: "Get instant notifications when new listings match your search"
                  }
                ].map((feature, index) => (
                  <div key={index} className="flex gap-4 group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center text-emerald-600 transition-colors">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-stone-900 mb-1">{feature.title}</h3>
                      <p className="text-stone-600 text-sm">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats Card */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl transform rotate-3" />
              <div className="relative bg-stone-900 rounded-3xl p-8 lg:p-12">
                <div className="grid grid-cols-2 gap-8">
                  <div className="text-center p-6 rounded-2xl bg-white/5">
                    <div className="text-4xl lg:text-5xl font-bold text-white mb-2">€2M+</div>
                    <div className="text-stone-400">Value Exchanged</div>
                  </div>
                  <div className="text-center p-6 rounded-2xl bg-white/5">
                    <div className="text-4xl lg:text-5xl font-bold text-white mb-2">50+</div>
                    <div className="text-stone-400">Events Covered</div>
                  </div>
                  <div className="text-center p-6 rounded-2xl bg-white/5">
                    <div className="text-4xl lg:text-5xl font-bold text-white mb-2">15min</div>
                    <div className="text-stone-400">Avg. Response Time</div>
                  </div>
                  <div className="text-center p-6 rounded-2xl bg-white/5">
                    <div className="text-4xl lg:text-5xl font-bold text-white mb-2">4.9★</div>
                    <div className="text-stone-400">User Rating</div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-white/10 flex items-center justify-center gap-2">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 border-2 border-stone-900"
                      />
                    ))}
                  </div>
                  <span className="text-stone-400 text-sm ml-2">
                    Join 2,500+ users
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-800 to-emerald-900">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/30 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl" />
          </div>
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-6">
            Ready to Start
            <span className="block text-emerald-400">Exchanging?</span>
          </h2>
          <p className="text-xl text-stone-300 mb-10 max-w-2xl mx-auto">
            Join thousands of runners and tour operators who are already 
            turning cancellations into opportunities.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <Link
                to="/listings/new"
                className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-stone-900 font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25"
              >
                <span>Create a Listing</span>
                <svg
                  className="w-5 h-5 transition-transform group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-stone-900 font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25"
                >
                  <span>Get Started Free</span>
                  <svg
                    className="w-5 h-5 transition-transform group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                <Link
                  to="/listings"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl border border-white/10 hover:border-white/20 transition-all duration-300 backdrop-blur-sm"
                >
                  Explore First
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-stone-900 border-t border-stone-800">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-white">Runoot</span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-8 text-sm">
              <a href="#" className="text-stone-400 hover:text-white transition-colors">About</a>
              <a href="#" className="text-stone-400 hover:text-white transition-colors">Contact</a>
              <a href="#" className="text-stone-400 hover:text-white transition-colors">Privacy</a>
              <a href="#" className="text-stone-400 hover:text-white transition-colors">Terms</a>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-stone-800">
            <p className="text-center text-sm text-stone-500">
              © {new Date().getFullYear()} Runoot Exchange. Platform for informational purposes only. 
              Transactions are between users.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
