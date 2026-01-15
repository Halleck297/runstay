import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { requireUser } from "~/lib/session.server";
import { supabase, supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";

export const meta: MetaFunction = () => {
  return [{ title: "Messages - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  // Get all conversations with last message and other participant info
  const { data: conversations } = await supabaseAdmin
    .from("conversations")
    .select(
      `
      *,
      listing:listings(id, title, listing_type),
      participant1:profiles!conversations_participant_1_fkey(id, full_name, company_name, user_type),
      participant2:profiles!conversations_participant_2_fkey(id, full_name, company_name, user_type),
      messages(id, content, sender_id, created_at, read_at)
    `
    )
    .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
    .order("updated_at", { ascending: false });

  return { user, conversations: conversations || [] };
}

export default function Messages() {
  const { user, conversations } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-full bg-gray-50">
      <Header user={user} />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-gray-900">
            Messages
          </h1>
          <p className="mt-2 text-gray-600">
            Your conversations with other users
          </p>
        </div>

        {conversations.length > 0 ? (
          <div className="card divide-y divide-gray-100">
            {conversations.map((conv: any) => {
              // Determine the other participant
              const otherUser =
                conv.participant_1 === user.id
                  ? conv.participant2
                  : conv.participant1;

              // Get last message
              const sortedMessages = [...(conv.messages || [])].sort(
                (a: any, b: any) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime()
              );
              const lastMessage = sortedMessages[0];

              // Check for unread
              const unreadCount = conv.messages?.filter(
                (m: any) => m.sender_id !== user.id && !m.read_at
              ).length;

              return (
                <Link
                  key={conv.id}
                  to={`/messages/${conv.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Avatar */}
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold flex-shrink-0">
                    {otherUser?.company_name?.charAt(0) ||
                      otherUser?.full_name?.charAt(0) ||
                      "?"}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`font-medium truncate ${
                          unreadCount > 0 ? "text-gray-900" : "text-gray-600"
                        }`}
                      >
                        {otherUser?.company_name || otherUser?.full_name || "User"}
                      </p>
                      {lastMessage && (
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatTimeAgo(lastMessage.created_at)}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-500 truncate mt-0.5">
                      Re: {conv.listing?.title || "Listing"}
                    </p>

                    {lastMessage && (
                      <p
                        className={`text-sm truncate mt-1 ${
                          unreadCount > 0 ? "text-gray-900" : "text-gray-500"
                        }`}
                      >
                        {lastMessage.sender_id === user.id && (
                          <span className="text-gray-400">You: </span>
                        )}
                        {lastMessage.content}
                      </p>
                    )}
                  </div>

                  {/* Unread indicator */}
                  {unreadCount > 0 && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white text-xs font-medium flex-shrink-0">
                      {unreadCount}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="card p-12 text-center">
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
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No messages yet
            </h3>
            <p className="mt-2 text-gray-600">
              Start a conversation by contacting a seller on a listing.
            </p>
            <Link to="/listings" className="mt-6 btn-primary inline-block">
              Browse Listings
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}
