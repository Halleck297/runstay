// app/routes/messages.tsx
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { Outlet, Link, useLoaderData, useParams, useSearchParams } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";
import { FooterLight } from "~/components/FooterLight";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { teamLeaderNavItems } from "~/components/panelNav";
import { useRealtimeConversations } from "~/hooks/useRealtimeConversations";
import { useI18n } from "~/hooks/useI18n";
import { getAvatarClasses } from "~/lib/avatarColors";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const userId = (user as any).id as string;
  const url = new URL(request.url);

  const { data: allConversations } = await supabaseAdmin
    .from("conversations")
    .select(
      `
      *,
      listing:listings(id, title, listing_type, author_id),
      participant1:profiles!conversations_participant_1_fkey(id, full_name, company_name, user_type),
      participant2:profiles!conversations_participant_2_fkey(id, full_name, company_name, user_type),
      messages(id, content, sender_id, created_at, read_at, message_type, detected_language, translated_content, translated_to)
    `
    )
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
    .order("updated_at", { ascending: false });

  // Filter out non-activated conversations for non-owners
  // Non-activated convos are only visible to the listing owner
  const conversations = (allConversations || []).filter((conv: any) => {
    // If activated, show to everyone
    if (conv.activated) return true;
    // If not activated, only show to listing owner
    return conv.listing?.author_id === userId;
  });

  // Auto-redirect to most recent conversation ONLY on desktop
  // On mobile, we want to show the conversation list first
  // We detect mobile via user-agent (not perfect but good enough for initial load)
  const userAgent = request.headers.get("user-agent") || "";
  const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  if (url.pathname === "/messages" && !url.searchParams.get("c") && conversations && conversations.length > 0 && !isMobile) {
    return redirect(`/messages?c=${(conversations[0] as any).short_id || (conversations[0] as any).id}`);
  }

  return { user, conversations: conversations || [] };
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
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear());
  return `${day}/${month}/${year}`;
}

export default function MessagesLayout() {
  const { t } = useI18n();
  const { user, conversations: initialConversations } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const params = useParams();
  const activeConversationId = searchParams.get("c") || params.id;

  // Use realtime conversations hook
  const { conversations } = useRealtimeConversations({
    userId: (user as any).id,
    initialConversations: initialConversations as any[],
  });

  const messagesContent = (
    <div
      className="flex-1 overflow-hidden bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ backgroundImage: "url('/messages.webp')" }}
    >
      <div className="h-full bg-gray-50/70">
        <div className="mx-auto max-w-7xl h-full px-0 md:px-4 lg:px-8 py-0 md:py-8">
        <div className="flex h-full md:rounded-lg shadow-xl overflow-hidden">

      {/* Colonna sinistra: Lista conversazioni */}
      {/* Mobile: mostra solo quando NON c'è conversazione attiva */}
      {/* Desktop: mostra sempre */}
      <aside
        className={`w-full md:w-80 lg:w-96 bg-white/95 backdrop-blur-sm md:rounded-l-lg flex flex-col overflow-hidden border-r border-gray-200 ${
          activeConversationId ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header lista */}
        <div className="p-4 border-b border-gray-200 flex items-center h-[72px]">
          <h1 className="font-display text-xl font-bold text-gray-900">
            {t("messages.title")}
          </h1>
        </div>

        {/* Lista conversazioni scrollabile */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {conversations.map((conv: any) => {
                const otherUser =
                  conv.participant_1 === (user as any).id
                    ? conv.participant2
                    : conv.participant1;

                const sortedMessages = [...(conv.messages || [])].sort(
                  (a: any, b: any) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                );
                const lastMessage = sortedMessages[0];

                const unreadCount = conv.messages?.filter(
                  (m: any) => m.sender_id !== (user as any).id && !m.read_at
                ).length;

                const convPublicId = conv.short_id || conv.id;
                const isActive = convPublicId === activeConversationId;

                return (
                  <Link
                    key={conv.id}
                    to={`/messages?c=${convPublicId}`}
                    className={`flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors ${
                      isActive ? "bg-gray-100" : ""
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full font-semibold flex-shrink-0 ${
                        isActive
                          ? "bg-brand-500 text-white"
                          : getAvatarClasses(otherUser?.id || "", otherUser?.user_type)
                      }`}
                    >
                      {otherUser?.company_name?.charAt(0) ||
                        otherUser?.full_name?.charAt(0) ||
                        "?"}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`font-medium truncate text-sm ${
                            unreadCount > 0 ? "text-gray-900" : "text-gray-600"
                          }`}
                        >
                          {otherUser?.company_name ||
                            otherUser?.full_name ||
                            t("messages.user")}
                        </p>
                        {lastMessage && (
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {formatTimeAgo(lastMessage.created_at)}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 truncate">
                        {conv.listing?.title || t("messages.listing")}
                      </p>

                      {lastMessage && (
                        <p
                          className={`text-sm truncate mt-0.5 ${
                            unreadCount > 0 ? "text-gray-900 font-medium" : "text-gray-500"
                          }`}
                        >
                          {lastMessage.sender_id === (user as any).id ? (
                            <>
                              <span className="text-gray-400">{t("messages.you_prefix")} </span>
                              {lastMessage.message_type === "heart"
                                ? t("messages.listing_saved")
                                : lastMessage.content}
                            </>
                          ) : (
                            lastMessage.message_type === "heart"
                              ? t("messages.listing_saved")
                              : lastMessage.translated_content || t("messages.new_message")
                          )}
                        </p>
                      )}
                    </div>

                    {/* Unread badge - rosso senza numero, sparisce se conversazione attiva */}
                    {unreadCount > 0 && !isActive && (
                      <div className="h-3 w-3 rounded-full bg-red-500 flex-shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-300"
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
              <p className="mt-4 text-sm text-gray-500">{t("messages.no_messages")}</p>
              <Link
                to="/listings"
                className="mt-4 btn-primary inline-block text-sm"
              >
                {t("messages.browse_listings")}
              </Link>
            </div>
          )}
        </div>

        {/* Footer mobile - solo quando lista conversazioni è visibile */}
        <div className="md:hidden">
          <FooterLight />
        </div>
      </aside>

      {/* Area centrale: Conversazione attiva */}
      <main
        className={`flex-1 flex flex-col min-w-0 overflow-hidden ${
          activeConversationId ? "flex" : "hidden md:flex"
        }`}
      >
        <Outlet context={{ user, conversations }} />
      </main>
        </div>
        </div>
        </div>
      </div>
  );

  if ((user as any).is_team_leader) {
    return (
      <ControlPanelLayout
        panelLabel="Team Leader Panel"
        mobileTitle="TL Panel"
        homeTo="/tl-dashboard"
        user={{
          fullName: (user as any).full_name as string | null | undefined,
          email: (user as any).email as string | null | undefined,
          roleLabel: "team leader",
        }}
        navItems={teamLeaderNavItems}
      >
        <div className="messages-page h-full flex flex-col bg-gray-50">
          {messagesContent}
        </div>
      </ControlPanelLayout>
    );
  }

  return (
    <div className="messages-page h-[calc(100dvh-4rem)] md:h-screen flex flex-col bg-gray-50">
      <Header user={user} />
      {messagesContent}
    </div>
  );
}
