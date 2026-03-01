// app/routes/messages.tsx
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { Outlet, Link, useLoaderData, useParams, useSearchParams } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";
import { FooterLight } from "~/components/FooterLight";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { buildTeamLeaderNavItems, tourOperatorNavItems } from "~/components/panelNav";
import { useRealtimeConversations } from "~/hooks/useRealtimeConversations";
import { useI18n } from "~/hooks/useI18n";
import { getTlEventNotificationSummary } from "~/lib/tl-event-notifications.server";
import { isTeamLeader, isTourOperator } from "~/lib/user-access";
import { getPublicDisplayName, getPublicInitial } from "~/lib/user-display";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const userId = (user as any).id as string;
  const url = new URL(request.url);
  const eventNotificationSummary = isTeamLeader(user)
    ? await getTlEventNotificationSummary(userId)
    : { totalUnread: 0 };

  const { data: allConversations } = await supabaseAdmin
    .from("conversations")
    .select(
      `
      *,
      listing:listings(id, title, listing_type, author_id),
      participant1:profiles!conversations_participant_1_fkey(id, full_name, company_name, user_type, avatar_url),
      participant2:profiles!conversations_participant_2_fkey(id, full_name, company_name, user_type, avatar_url),
      messages(id, content, sender_id, created_at, read_at, message_type, detected_language, translated_content, translated_to)
    `
    )
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false, foreignTable: "messages" })
    .limit(1, { foreignTable: "messages" });

  const conversationIds = (allConversations || []).map((conv: any) => conv.id);
  const unreadCountByConversation: Record<string, number> = {};
  if (conversationIds.length > 0) {
    const { data: unreadRows } = await supabaseAdmin
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", conversationIds)
      .neq("sender_id", userId)
      .is("read_at", null);

    for (const row of unreadRows || []) {
      const conversationId = (row as any).conversation_id as string;
      unreadCountByConversation[conversationId] = (unreadCountByConversation[conversationId] || 0) + 1;
    }
  }

  // Filter out non-activated conversations for non-owners
  // Non-activated convos are only visible to the listing owner
  const conversations = (allConversations || [])
    .filter((conv: any) => {
      const isDeletedForCurrentUser =
        (conv.participant_1 === userId && conv.deleted_by_1) ||
        (conv.participant_2 === userId && conv.deleted_by_2);
      if (isDeletedForCurrentUser) return false;

      // If activated, show to everyone
      if (conv.activated) return true;
      // If not activated, only show to listing owner
      return conv.listing?.author_id === userId;
    })
    .map((conv: any) => ({
      ...conv,
      unread_count: unreadCountByConversation[conv.id] || 0,
    }));

  // Auto-redirect to most recent conversation ONLY on desktop
  // On mobile, we want to show the conversation list first
  // We detect mobile via user-agent (not perfect but good enough for initial load)
  const userAgent = request.headers.get("user-agent") || "";
  const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  if (url.pathname === "/messages" && !url.searchParams.get("c") && conversations && conversations.length > 0 && !isMobile) {
    return redirect(`/messages?c=${(conversations[0] as any).short_id || (conversations[0] as any).id}`);
  }

  return { user, conversations: conversations || [], eventUnreadCount: eventNotificationSummary.totalUnread };
}

export default function MessagesLayout() {
  const { t, locale } = useI18n();
  const { user, conversations: initialConversations, eventUnreadCount } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const params = useParams();
  const activeConversationId = searchParams.get("c") || params.id;

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return t("notifications.just_now");

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return rtf.format(-diffMinutes, "minute");

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return rtf.format(-diffHours, "hour");

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return rtf.format(-diffDays, "day");

    return date.toLocaleDateString(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Use realtime conversations hook
  const { conversations } = useRealtimeConversations({
    userId: (user as any).id,
    initialConversations: initialConversations as any[],
  });

  const messagesContent = (
    <div className="flex-1 overflow-hidden bg-[#ECF4FE] bg-[radial-gradient(circle_at_1px_1px,rgba(12,120,243,0.08)_1px,transparent_0)] bg-[size:18px_18px]">
      <div className="mx-auto h-full max-w-7xl px-0 py-0 md:px-4 md:py-8 lg:px-8">
        <div className="flex h-full overflow-hidden border border-gray-200/80 bg-white/85 shadow-xl backdrop-blur-[2px] md:rounded-3xl">

      {/* Colonna sinistra: Lista conversazioni */}
      {/* Mobile: mostra solo quando NON c'è conversazione attiva */}
      {/* Desktop: mostra sempre */}
      <aside
        className={`w-full md:w-80 lg:w-96 bg-white/95 backdrop-blur-[2px] md:rounded-l-3xl flex flex-col overflow-hidden border-r border-gray-200 ${
          activeConversationId ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header lista */}
        <div className="p-4 border-b border-gray-200 bg-white/95 flex items-center h-[72px]">
          <h1 className="font-display text-xl font-bold text-gray-900">
            {t("messages.title")}
          </h1>
        </div>

        {/* Lista conversazioni scrollabile */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length > 0 ? (
            <div>
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

                const unreadCount =
                  typeof conv.unread_count === "number"
                    ? conv.unread_count
                    : conv.messages?.filter(
                        (m: any) => m.sender_id !== (user as any).id && !m.read_at
                      ).length;

                const convPublicId = conv.short_id || conv.id;
                const isActive = convPublicId === activeConversationId;
                const unreadLabel = unreadCount > 99 ? "99+" : String(unreadCount);

                return (
                  <Link
                    key={conv.id}
                    to={`/messages?c=${convPublicId}`}
                    className={`relative flex items-center gap-3 border-y border-gray-200 p-4 hover:bg-[#ECF4FE] transition-all duration-200 ease-out ${
                      isActive ? "bg-[#ECF4FE] shadow-sm" : "md:hover:-translate-y-[1px] md:hover:shadow-sm"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-accent-500 transition-all duration-200" />
                    )}

                    {/* Avatar */}
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-100 font-semibold text-gray-700 flex-shrink-0">
                      {otherUser?.avatar_url ? (
                        <img
                          src={otherUser.avatar_url}
                          alt={getPublicDisplayName(otherUser)}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        getPublicInitial(otherUser)
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`truncate text-sm font-semibold ${
                            unreadCount > 0 ? "text-gray-900" : "text-gray-700"
                          }`}
                        >
                          {getPublicDisplayName(otherUser) || t("messages.user")}
                        </p>
                        {lastMessage && (
                          <span className={`text-xs flex-shrink-0 ${unreadCount > 0 ? "text-gray-500" : "text-gray-400"}`}>
                            {formatTimeAgo(lastMessage.created_at)}
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 text-xs text-gray-400 truncate">
                        {conv.listing?.title || t("messages.listing")}
                      </p>

                      {lastMessage && (
                        <p
                          className={`text-sm truncate mt-1 leading-5 ${
                            unreadCount > 0 ? "text-gray-800 font-medium" : "text-gray-500"
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

                    {/* Unread badge - numerico, sparisce se conversazione attiva */}
                    {unreadCount > 0 && !isActive && (
                      <div className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold leading-none flex items-center justify-center flex-shrink-0 transition-transform duration-200 md:hover:scale-105">
                        {unreadLabel}
                      </div>
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
  );

  if (isTeamLeader(user)) {
    return (
      <ControlPanelLayout
        panelLabel="Team Leader Panel"
        mobileTitle="TL Panel"
        homeTo="/tl-dashboard"
        user={{
          fullName: (user as any).full_name as string | null | undefined,
          email: (user as any).email as string | null | undefined,
          roleLabel: "team leader",
          avatarUrl: (user as any).avatar_url as string | null | undefined,
        }}
        navItems={buildTeamLeaderNavItems(eventUnreadCount || 0)}
      >
        <div className="messages-page h-full flex flex-col">
          {messagesContent}
        </div>
      </ControlPanelLayout>
    );
  }

  if (isTourOperator(user)) {
    return (
      <ControlPanelLayout
        panelLabel="Tour Operator Panel"
        mobileTitle="TO Panel"
        homeTo="/to-panel"
        user={{
          fullName: (user as any).full_name as string | null | undefined,
          email: (user as any).email as string | null | undefined,
          roleLabel: "tour operator",
          avatarUrl: (user as any).avatar_url as string | null | undefined,
        }}
        navItems={tourOperatorNavItems}
      >
        <div className="messages-page h-full flex flex-col">
          {messagesContent}
        </div>
      </ControlPanelLayout>
    );
  }

  return (
    <div className="messages-page h-[calc(100dvh-4rem)] md:h-screen flex flex-col">
      <Header user={user} />
      {messagesContent}
    </div>
  );
}
