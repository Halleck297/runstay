import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData, redirect } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabase, supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";
import { ListingCardCompact } from "~/components/ListingCardCompact";


export const meta: MetaFunction = () => {
  return [{ title: "Dashboard - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  // Dashboard is only for tour operators
  if (user.user_type !== "tour_operator") {
    return redirect("/listings");
  }

  // Get user's listings
  const { data: listings } = await supabaseAdmin
    .from("listings")
    .select(
      `
      *,
      event:events(id, name, slug, country, event_date),
      author:profiles(id, full_name, company_name, user_type, is_verified)
    `
    )
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });

  // Get user's conversations
  const { data: conversations } = await supabaseAdmin
    .from("conversations")
    .select(
      `
      *,
      listing:listings(id, title),
      messages(id, content, sender_id, created_at, read_at)
    `
    )
    .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
    .order("updated_at", { ascending: false })
    .limit(5);

  // Count unread messages
  let unreadCount = 0;
  conversations?.forEach((conv: any) => {
    conv.messages?.forEach((msg: any) => {
      if (msg.sender_id !== user.id && !msg.read_at) {
        unreadCount++;
      }
    });
  });

  return {
    user,
    listings: listings || [],
    conversations: conversations || [],
    unreadCount,
  };
}

const statusColors = {
  active: "bg-success-100 text-success-700 border border-success-200",
  sold: "bg-gray-100 text-gray-700 border border-gray-200",
  expired: "bg-alert-100 text-alert-700 border border-alert-200",
};

export default function Dashboard() {
  const { user, listings, conversations, unreadCount } =
    useLoaderData<typeof loader>();

  const activeListings = listings.filter((l: any) => l.status === "active");
  const soldListings = listings.filter((l: any) => l.status === "sold");

  return (
    <div className="min-h-screen bg-gray-100 md:bg-[url('/savedBG.png')] md:bg-cover md:bg-center md:bg-fixed">
      <div className="min-h-screen md:bg-gray-50/85">
        <Header user={user} />

        {/* ============================================ */}
        {/* MOBILE VERSION */}
        {/* ============================================ */}
        <main className="md:hidden px-4 pt-20 pb-20">
          {/* Header row */}
          <div className="flex items-center justify-between mb-5">
            <h1 className="font-display text-lg font-bold text-gray-900">Dashboard</h1>
            <Link
              to="/listings/new"
              className="bg-accent-500 text-white rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium shadow-sm active:bg-accent-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Listing
            </Link>
          </div>

          {/* Stats 2x2 grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{activeListings.length}</p>
                  <p className="text-xs text-gray-500">Active</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{soldListings.length}</p>
                  <p className="text-xs text-gray-500">Sold</p>
                </div>
              </div>
            </div>

            <Link to="/messages" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 active:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{conversations.length}</p>
                  <p className="text-xs text-gray-500">Chats</p>
                </div>
              </div>
            </Link>

            <Link to="/messages" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 active:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${unreadCount > 0 ? 'bg-accent-100' : 'bg-gray-100'}`}>
                  <svg className={`w-5 h-5 ${unreadCount > 0 ? 'text-accent-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${unreadCount > 0 ? 'text-accent-600' : 'text-gray-900'}`}>{unreadCount}</p>
                  <p className="text-xs text-gray-500">Unread</p>
                </div>
              </div>
            </Link>
          </div>


          {/* My Listings Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-gray-900">My Listings</h2>
              {listings.length > 3 && (
                <Link to="/my-listings" className="text-sm text-brand-600 font-medium">
                  See all
                </Link>
              )}
            </div>

            {listings.length > 0 ? (
              <div className="space-y-3">
                {listings.slice(0, 3).map((listing: any) => (
                  <div key={listing.id} className="relative">
                    <ListingCardCompact listing={listing} isUserLoggedIn={true} />
                    <div className="absolute top-3 right-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[listing.status as keyof typeof statusColors]}`}>
                        {listing.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl p-6 text-center border border-gray-100">
                <p className="text-gray-500 text-sm">No listings yet</p>
                <Link to="/listings/new" className="text-brand-600 text-sm font-medium mt-2 inline-block">
                  Create your first listing →
                </Link>
              </div>
            )}
          </div>

          {/* Recent Messages Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-gray-900">Recent Messages</h2>
              {conversations.length > 0 && (
                <Link to="/messages" className="text-sm text-brand-600 font-medium">
                  See all
                </Link>
              )}
            </div>

            {conversations.length > 0 ? (
              <div className="bg-white rounded-xl overflow-hidden border border-gray-100">
                {conversations.slice(0, 3).map((conv: any, index: number) => {
                  const lastMessage = conv.messages?.[conv.messages.length - 1];
                  const hasUnread = conv.messages?.some((m: any) => m.sender_id !== user.id && !m.read_at);

                  return (
                    <Link
                      key={conv.id}
                      to={`/messages/${conv.id}`}
                      className={`flex items-center gap-3 p-4 active:bg-gray-50 ${index > 0 ? 'border-t border-gray-100' : ''}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${hasUnread ? 'bg-brand-100' : 'bg-gray-100'}`}>
                        <svg className={`w-5 h-5 ${hasUnread ? 'text-brand-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${hasUnread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                          {conv.listing?.title || "Conversation"}
                        </p>
                        {lastMessage && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {lastMessage.content}
                          </p>
                        )}
                      </div>
                      {hasUnread && (
                        <span className="w-2.5 h-2.5 rounded-full bg-brand-500 flex-shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-xl p-6 text-center border border-gray-100">
                <p className="text-gray-500 text-sm">No conversations yet</p>
                <Link to="/listings" className="text-brand-600 text-sm font-medium mt-2 inline-block">
                  Browse listings →
                </Link>
              </div>
            )}
          </div>
        </main>

        {/* ============================================ */}
        {/* DESKTOP VERSION */}
        {/* ============================================ */}
        <main className="hidden md:block mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Welcome - Glassmorphism container */}
          <div className="mb-8 bg-white/70 backdrop-blur-sm rounded-xl shadow-md p-6">
            <h1 className="font-display text-3xl font-bold text-gray-900">
              Welcome back, {user.full_name || user.email.split("@")[0]}
            </h1>
            <p className="mt-2 text-gray-600">
              Manage your listings and conversations
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="card p-6">
              <p className="text-sm text-gray-500">Active Listings</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {activeListings.length}
              </p>
            </div>
            <div className="card p-6">
              <p className="text-sm text-gray-500">Sold</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {soldListings.length}
              </p>
            </div>
            <div className="card p-6">
              <p className="text-sm text-gray-500">Conversations</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {conversations.length}
              </p>
            </div>
            <div className="card p-6">
              <p className="text-sm text-gray-500">Unread Messages</p>
              <p className="mt-2 text-3xl font-bold text-brand-600">
                {unreadCount}
              </p>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* My Listings */}
            <div className="card">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-gray-900">
                  My Listings
                </h2>
                <Link
                  to="/listings/new"
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  + New Listing
                </Link>
              </div>

              {listings.length > 0 ? (
                <div className="p-4 space-y-3">
                  {listings.slice(0, 5).map((listing: any) => (
                    <div key={listing.id} className="relative">
                      <ListingCardCompact listing={listing} isUserLoggedIn={true} />
                      {/* Status badge overlay */}
                      <div className="absolute top-3 right-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm ${
                            statusColors[listing.status as keyof typeof statusColors]
                          }`}
                        >
                          {listing.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-500">No listings yet</p>
                  <Link
                    to="/listings/new"
                    className="mt-4 inline-block text-brand-600 hover:text-brand-700 font-medium"
                  >
                    Create your first listing →
                  </Link>
                </div>
              )}

              {listings.length > 5 && (
                <div className="p-4 border-t border-gray-100">
                  <Link
                    to="/my-listings"
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    View all {listings.length} listings →
                  </Link>
                </div>
              )}
            </div>

            {/* Recent Conversations */}
            <div className="card">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-gray-900">
                  Recent Messages
                </h2>
                <Link
                  to="/messages"
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  View All
                </Link>
              </div>

              {conversations.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {conversations.map((conv: any) => {
                    const lastMessage = conv.messages?.[conv.messages.length - 1];
                    const hasUnread = conv.messages?.some(
                      (m: any) => m.sender_id !== user.id && !m.read_at
                    );

                    return (
                      <Link
                        key={conv.id}
                        to={`/messages/${conv.id}`}
                        className="block p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p
                              className={`font-medium truncate ${
                                hasUnread ? "text-gray-900" : "text-gray-600"
                              }`}
                            >
                              {conv.listing?.title || "Conversation"}
                            </p>
                            {lastMessage && (
                              <p className="text-sm text-gray-500 mt-1 truncate">
                                {lastMessage.content}
                              </p>
                            )}
                          </div>
                          {hasUnread && (
                            <span className="ml-4 h-2.5 w-2.5 rounded-full bg-brand-500" />
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-500">No conversations yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Start by browsing listings
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Profile section */}
          <div className="mt-8 card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-2xl">
                  {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-lg">
                    {user.full_name || user.email}
                  </p>
                  <p className="text-gray-500">
                    {user.user_type === "tour_operator"
                      ? user.company_name || "Tour Operator"
                      : "Private Runner"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {user.is_verified ? (
                      <span className="inline-flex items-center gap-1 text-sm text-brand-600">
                        <svg
                          className="h-4 w-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Verified
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">Not verified</span>
                    )}
                  </div>
                </div>
              </div>
              <Link to="/profile" className="btn-secondary">
                Edit Profile
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
