// app/routes/messages.tsx
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { Outlet, Link, useLoaderData, useParams, useSearchParams, useNavigate } from "react-router";
import { useEffect, useLayoutEffect, useRef } from "react";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { buildTeamLeaderNavItems, tourOperatorNavItems } from "~/components/panelNav";
import { useRealtimeConversations } from "~/hooks/useRealtimeConversations";
import { useI18n } from "~/hooks/useI18n";
import { getTlEventNotificationSummary } from "~/lib/tl-event-notifications.server";
import { isTeamLeader, isTourOperator } from "~/lib/user-access";
import { getPublicDisplayName, getPublicInitial, getShortDisplayName } from "~/lib/user-display";

type MessagesUser = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

type MessagesListing = {
  id: string;
  title?: string | null;
  listing_type?: string | null;
  author_id?: string | null;
};

type MessagesParticipant = {
  id: string;
  full_name?: string | null;
  company_name?: string | null;
  user_type?: string | null;
  avatar_url?: string | null;
};

type MessagesPreview = {
  id: string;
  content?: string | null;
  sender_id: string;
  created_at: string;
  read_at?: string | null;
  message_type?: string | null;
  translated_content?: string | null;
};

type ConversationListItem = {
  id: string;
  short_id: string;
  listing_id: string;
  participant_1: string;
  participant_2: string;
  updated_at: string;
  deleted_by_1?: boolean;
  deleted_by_2?: boolean;
  activated?: boolean;
  listing?: MessagesListing | null;
  participant1?: MessagesParticipant | null;
  participant2?: MessagesParticipant | null;
  messages?: MessagesPreview[];
  unread_count?: number;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const typedUser = user as MessagesUser;
  const userId = typedUser.id;
  const url = new URL(request.url);
  const eventNotificationSummary = isTeamLeader(user)
    ? await getTlEventNotificationSummary(userId)
    : { totalUnread: 0 };

  const { data: allConversationsRaw } = await supabaseAdmin
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

  const allConversations = (allConversationsRaw || []) as unknown as ConversationListItem[];
  const conversationIds = allConversations.map((conv) => conv.id);
  const unreadCountByConversation: Record<string, number> = {};
  if (conversationIds.length > 0) {
    const { data: unreadRows } = await supabaseAdmin
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", conversationIds)
      .neq("sender_id", userId)
      .is("read_at", null);

    for (const row of (unreadRows || []) as { conversation_id: string }[]) {
      const conversationId = row.conversation_id;
      unreadCountByConversation[conversationId] = (unreadCountByConversation[conversationId] || 0) + 1;
    }
  }

  // Filter out non-activated conversations for non-owners
  // Non-activated convos are only visible to the listing owner
  const conversations = allConversations
    .filter((conv) => {
      const isDeletedForCurrentUser =
        (conv.participant_1 === userId && conv.deleted_by_1) ||
        (conv.participant_2 === userId && conv.deleted_by_2);
      if (isDeletedForCurrentUser) return false;

      // If activated, show to everyone
      if (conv.activated) return true;
      // If not activated, only show to listing owner
      return conv.listing?.author_id === userId;
    })
    .map((conv) => ({
      ...conv,
      unread_count: unreadCountByConversation[conv.id] || 0,
    }));

  return { user, conversations: conversations || [], eventUnreadCount: eventNotificationSummary.totalUnread };
}

export default function MessagesLayout() {
  const { t, locale } = useI18n();
  const { user, conversations: initialConversations, eventUnreadCount } = useLoaderData<typeof loader>();
  const typedUser = user as MessagesUser;
  const userId = typedUser.id;
  const [searchParams] = useSearchParams();
  const params = useParams();
  const navigate = useNavigate();
  const activeConversationId = searchParams.get("c") || params.id;
  const mobileSubtitle = activeConversationId ? undefined : t("messages.title");

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
    userId,
    initialConversations: initialConversations as ConversationListItem[],
  });

  // Scroll conversation list to top when showing the list (no active conversation)
  const conversationListRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!activeConversationId && conversationListRef.current) {
      conversationListRef.current.scrollTop = 0;
    }
  }, [activeConversationId]);

  // Auto-redirect to last conversation on desktop
  useEffect(() => {
    if (!activeConversationId && conversations.length > 0 && window.innerWidth >= 768) {
      const first = conversations[0];
      navigate(`/messages?c=${first.short_id || first.id}`, { replace: true });
    }
  }, []);

  const panelConfig = isTeamLeader(user)
    ? {
        panelLabel: "Team Leader Panel",
        mobileTitle: "Team Leader",
        homeTo: "/tl-dashboard",
        roleLabel: "team leader",
        navItems: buildTeamLeaderNavItems(eventUnreadCount || 0),
      }
    : isTourOperator(user)
      ? {
          panelLabel: "Tour Operator Panel",
          mobileTitle: "Tour Operator",
          homeTo: "/to-panel",
          roleLabel: "tour operator",
          navItems: tourOperatorNavItems,
        }
      : null;

  const messagesContent = (
    <div className="flex-1 overflow-hidden md:overflow-x-auto md:overflow-y-hidden md:bg-[#ECF4FE] md:bg-[radial-gradient(circle_at_1px_1px,rgba(12,120,243,0.08)_1px,transparent_0)] md:bg-[size:18px_18px]">
      <div className="mx-auto h-full min-w-full md:min-w-[980px] max-w-7xl px-0 py-0 md:px-4 md:py-8 lg:px-8">
        <div className="flex h-full overflow-hidden bg-white md:rounded-3xl md:border md:border-brand-300 md:bg-white/85 md:backdrop-blur-[2px]">

      {/* Colonna sinistra: Lista conversazioni */}
      {/* Mobile: mostra solo quando NON c'è conversazione attiva */}
      {/* Desktop: mostra sempre */}
      <aside
        ref={conversationListRef}
        className={`w-full md:w-80 lg:w-96 md:shrink-0 bg-white/95 backdrop-blur-[2px] md:rounded-l-3xl flex flex-col overflow-y-auto border-r border-gray-200 ${
          activeConversationId ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header lista */}
        <div className={`sticky top-0 z-20 border-b border-gray-200 bg-white/95 px-4 py-2.5 items-center justify-center h-[58px] md:flex md:h-[84px] md:p-4 md:pt-6 ${panelConfig ? "hidden md:flex" : "flex"}`}>
          <h1 className="text-center font-display text-xl font-bold text-gray-900 underline decoration-accent-500 underline-offset-4">
            {t("messages.title")}
          </h1>
        </div>

        {/* Lista conversazioni scrollabile */}
        <div className="flex-1">
          {conversations.length > 0 ? (
            <div>
              {conversations.map((conv: ConversationListItem) => {
                const otherUser =
                  conv.participant_1 === userId
                    ? conv.participant2
                    : conv.participant1;

                const sortedMessages = [...(conv.messages || [])].sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                );
                const lastMessage = sortedMessages[0];
                const previewMessage =
                  sortedMessages.find((m) => m.message_type !== "heart") || lastMessage;
                const hasListingSavedMarker = sortedMessages.some((m) => m.message_type === "heart");

                const unreadCount =
                  typeof conv.unread_count === "number"
                    ? conv.unread_count
                    : conv.messages?.filter(
                        (m) => m.sender_id !== userId && !m.read_at
                      ).length ?? 0;

                const convPublicId = conv.short_id || conv.id;
                const isActive = convPublicId === activeConversationId;
                const unreadLabel = unreadCount > 99 ? "99+" : String(unreadCount);

                return (
                  <Link
                    key={conv.id}
                    to={`/messages?c=${convPublicId}`}
                    className={`relative flex items-center gap-3 border-y border-gray-200 p-4 hover:bg-[#ECF4FE] transition-all duration-200 ease-out [-webkit-tap-highlight-color:transparent] ${
                      isActive ? "md:bg-[#ECF4FE] md:shadow-sm" : "md:hover:-translate-y-[1px] md:hover:shadow-sm"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 hidden w-1 rounded-r-full bg-accent-500 transition-all duration-200 md:block" />
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
                          {getShortDisplayName(otherUser) || t("messages.user")}
                        </p>
                        {previewMessage && (
                          <span className={`text-xs flex-shrink-0 ${unreadCount > 0 ? "text-gray-500" : "text-gray-400"}`}>
                            {formatTimeAgo(previewMessage.created_at)}
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 text-xs text-gray-400 truncate">
                        {conv.listing?.title || t("messages.listing")}
                      </p>

                      {previewMessage && (
                        <div className="mt-1 flex items-center gap-2">
                          {(() => {
                            const previewText =
                              previewMessage.message_type === "heart"
                                ? ""
                                : previewMessage.sender_id === userId
                                  ? (previewMessage.content || "").trim()
                                  : (previewMessage.translated_content || previewMessage.content || "").trim();
                            const ownPrefix = t("messages.you_prefix");
                            return (
                          <p
                            className={`min-w-0 flex-1 truncate text-sm leading-5 ${
                              unreadCount > 0 ? "text-gray-800 font-medium" : "text-gray-500"
                            }`}
                          >
                            {previewText
                              ? previewMessage.sender_id === userId
                                ? (
                                  <>
                                    <span className="text-gray-400">{ownPrefix} </span>
                                    {previewText}
                                  </>
                                )
                                : previewText
                              : ""}
                          </p>
                            );
                          })()}
                          {hasListingSavedMarker && (
                            <span
                              className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-red-500"
                              aria-label={t("messages.listing_saved")}
                              title={t("messages.listing_saved")}
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                              </svg>
                            </span>
                          )}
                        </div>
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

      </aside>

      {/* Area centrale: Conversazione attiva */}
      <main
        className={`flex-1 flex flex-col min-h-0 min-w-0 md:min-w-[620px] overflow-hidden ${
          activeConversationId ? "flex" : "hidden md:flex"
        }`}
      >
        <Outlet context={{ user, conversations }} />
      </main>
        </div>
      </div>
      </div>
  );

  if (panelConfig) {
    return (
      <ControlPanelLayout
        panelLabel={panelConfig.panelLabel}
        mobileTitle={panelConfig.mobileTitle}
        mobileSubtitle={mobileSubtitle}
        homeTo={panelConfig.homeTo}
        user={{
          fullName: typedUser.full_name,
          email: typedUser.email,
          roleLabel: panelConfig.roleLabel,
          avatarUrl: typedUser.avatar_url,
        }}
        navItems={panelConfig.navItems}
        fixedHeight
      >
        <div className="messages-page messages-page-with-panel m-0 flex h-full min-h-0 flex-col">
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
