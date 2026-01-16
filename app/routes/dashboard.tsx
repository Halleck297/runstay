import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { requireUser } from "~/lib/session.server";
import { supabase, supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";
import { ListingCardCompact } from "~/components/ListingCardCompact";


export const meta: MetaFunction = () => {
  return [{ title: "Dashboard - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  // Get user's listings
  const { data: listings } = await supabaseAdmin
    .from("listings")
    .select(
      `
      *,
      event:events(id, name, location, event_date),
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
    <div className="min-h-full bg-gray-50">
      <Header user={user} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome */}
        <div className="mb-8">
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
        to="/dashboard/listings"
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
  );
}
