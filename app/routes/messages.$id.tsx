import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData, useFetcher, useLoaderData, useNavigation, useNavigate } from "react-router";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "~/hooks/useI18n";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { sendToUnifiedNotificationEmail } from "~/lib/to-notifications.server";
import { useRealtimeMessages } from "~/hooks/useRealtimeMessages";
import { useTranslation } from "~/hooks/useTranslation";
import { applyConversationPublicIdFilter } from "~/lib/conversation.server";
import { getPublicDisplayName, getPublicInitial } from "~/lib/user-display";

export const meta: MetaFunction = () => {
  return [{ title: "Conversation - Runoot" }];
};
const MESSAGE_PAGE_SIZE = 50;

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const userId = (user as any).id as string;
  const publicConversationId = params.id;
  const url = new URL(request.url);

  if (!publicConversationId) {
    throw new Response("Conversation not found", { status: 404 });
  }

  // Canonical URL for conversations is /messages?c=<public_id>
  if (url.pathname.startsWith("/messages/")) {
    return redirect(`/messages?c=${publicConversationId}`);
  }

  const baseQuery = supabaseAdmin
    .from("conversations")
    .select(
      `
      *,
      listing:listings(id, title, listing_type, status, event:events(id, name, slug)),
      participant1:profiles!conversations_participant_1_fkey(id, full_name, company_name, user_type, is_verified, avatar_url),
      participant2:profiles!conversations_participant_2_fkey(id, full_name, company_name, user_type, is_verified, avatar_url)
    `
    );

  const { data: conversation, error } = await applyConversationPublicIdFilter(
    baseQuery as any,
    publicConversationId
  ).single();

  if (error || !conversation) {
    throw new Response("Conversation not found", { status: 404 });
  }

  if (
    conversation.participant_1 !== userId &&
    conversation.participant_2 !== userId
  ) {
    throw new Response("Unauthorized", { status: 403 });
  }

  const isDeletedForCurrentUser =
    (conversation.participant_1 === userId && conversation.deleted_by_1) ||
    (conversation.participant_2 === userId && conversation.deleted_by_2);
  if (isDeletedForCurrentUser) {
    throw new Response("Conversation not found", { status: 404 });
  }

  // Check if user already blocked the other participant
  const otherUserId = conversation.participant_1 === userId 
    ? conversation.participant_2 
    : conversation.participant_1;

  const [blockedByMeResult, blockedByOtherResult] = await Promise.all([
    supabaseAdmin
      .from("blocked_users")
      .select("id")
      .eq("blocker_id", userId)
      .eq("blocked_id", otherUserId)
      .maybeSingle(),
    supabaseAdmin
      .from("blocked_users")
      .select("id")
      .eq("blocker_id", otherUserId)
      .eq("blocked_id", userId)
      .maybeSingle(),
  ]);

  const isBlocked = !!blockedByMeResult.data;
  const isBlockedByOther = !!blockedByOtherResult.data;

  const { data: latestMessages } = await supabaseAdmin
    .from("messages")
    .select("id, conversation_id, content, sender_id, created_at, read_at, message_type, detected_language, translated_content, translated_to")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_PAGE_SIZE);

  const loadedMessages = [...(latestMessages || [])].sort(
    (a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const unreadMessageIds = loadedMessages
    .filter((m: any) => m.sender_id !== userId && !m.read_at)
    .map((m: any) => m.id);

  if (unreadMessageIds.length > 0) {
    const now = new Date().toISOString();

    await (supabaseAdmin.from("messages") as any)
      .update({ read_at: now })
      .in("id", unreadMessageIds);

    for (const message of loadedMessages as any[]) {
      if (unreadMessageIds.includes(message.id)) {
        message.read_at = now;
      }
    }
  }

  // Keep menu badges in sync: opening a conversation consumes related "new message" notifications
  await (supabaseAdmin.from("notifications") as any)
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("type", "system")
    .filter("data->>kind", "eq", "new_message")
    .filter("data->>conversation_id", "eq", conversation.id)
    .is("read_at", null);

  // If this is a mock account conversation, consume related owner-admin alerts too.
  await (supabaseAdmin.from("notifications") as any)
    .update({ read_at: new Date().toISOString() })
    .eq("type", "system")
    .filter("data->>kind", "eq", "mock_user_new_message")
    .filter("data->>mock_user_id", "eq", userId)
    .filter("data->>conversation_id", "eq", (conversation.short_id || conversation.id))
    .is("read_at", null);

  let hasOlderMessages = false;
  if (loadedMessages.length > 0) {
    const oldestLoadedAt = loadedMessages[0].created_at;
    const { count: olderCount } = await supabaseAdmin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversation.id)
      .lt("created_at", oldestLoadedAt);
    hasOlderMessages = (olderCount || 0) > 0;
  }

  return {
    user,
    conversation: { ...conversation, messages: loadedMessages },
    isBlocked,
    isBlockedByOther,
    hasOlderMessages,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const userId = (user as any).id as string;
  const publicConversationId = params.id;

  if (!publicConversationId) {
    return data({ errorKey: "conversation_not_found" as const }, { status: 404 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  // Get conversation to verify participation
  const conversationQuery = supabaseAdmin
    .from("conversations")
    .select("id, short_id, participant_1, participant_2, deleted_by_1, deleted_by_2, listing_id, activated, listing:listings(author_id, title)")
    ;
  const { data: conversation } = await applyConversationPublicIdFilter(
    conversationQuery as any,
    publicConversationId
  ).single();

  if (
    !conversation ||
    (conversation.participant_1 !== userId &&
      conversation.participant_2 !== userId)
  ) {
    return data({ errorKey: "unauthorized" as const }, { status: 403 });
  }

  const isDeletedForCurrentUser =
    (conversation.participant_1 === userId && conversation.deleted_by_1) ||
    (conversation.participant_2 === userId && conversation.deleted_by_2);
  if (isDeletedForCurrentUser) {
    return data({ errorKey: "conversation_not_found" as const }, { status: 404 });
  }

  const otherUserId = conversation.participant_1 === userId
    ? conversation.participant_2
    : conversation.participant_1;

  const isListingOwner = conversation.listing?.author_id === userId;

  const [blockedByMeResult, blockedByOtherResult] = await Promise.all([
    supabaseAdmin
      .from("blocked_users")
      .select("id")
      .eq("blocker_id", userId)
      .eq("blocked_id", otherUserId)
      .maybeSingle(),
    supabaseAdmin
      .from("blocked_users")
      .select("id")
      .eq("blocker_id", otherUserId)
      .eq("blocked_id", userId)
      .maybeSingle(),
  ]);
  const isBlockedByMe = !!blockedByMeResult.data;
  const isBlockedByOther = !!blockedByOtherResult.data;

  // Handle different actions
  if (intent === "block") {
    const { error } = await supabaseAdmin.from("blocked_users").insert({
      blocker_id: userId,
      blocked_id: otherUserId,
    } as any);

    if (error && !error.message.includes("duplicate")) {
      return data({ errorKey: "failed_block_user" as const }, { status: 500 });
    }

    return data({ success: true, action: "blocked" });
  }

  if (intent === "unblock") {
    await supabaseAdmin
      .from("blocked_users")
      .delete()
      .eq("blocker_id", userId)
      .eq("blocked_id", otherUserId);

    return data({ success: true, action: "unblocked" });
  }

  if (intent === "delete") {
    // Soft delete - mark as deleted for this user
    const isParticipant1 = conversation.participant_1 === userId;
    
    await (supabaseAdmin.from("conversations") as any)
      .update(isParticipant1 ? { deleted_by_1: true } : { deleted_by_2: true })
      .eq("id", conversation.id);

    return redirect("/messages");
  }

  // Default: send message
  const content = formData.get("content");

  if (isBlockedByMe || isBlockedByOther) {
    return data({ errorKey: "blocked_send" as const }, { status: 403 });
  }

  if (typeof content !== "string" || !content.trim()) {
    return data({ errorKey: "empty_message" as const }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("messages").insert({
    conversation_id: conversation.id,
    sender_id: userId,
    content: content.trim(),
    message_type: "user",
  } as any);

  if (error) {
    return data({ errorKey: "failed_send_message" as const }, { status: 500 });
  }

  // If the listing owner is replying and conversation is not activated, activate it
  if (isListingOwner && !conversation.activated) {
    await (supabaseAdmin.from("conversations") as any)
      .update({ activated: true, updated_at: new Date().toISOString() })
      .eq("id", conversation.id);
  } else {
    await (supabaseAdmin.from("conversations") as any)
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation.id);
  }

  await sendToUnifiedNotificationEmail({
    userId: otherUserId,
    prefKey: "new_message",
    message: "You have a new message in your Runoot inbox.",
    ctaUrl: `/messages?c=${conversation.short_id || conversation.id}`,
  });

  // If recipient is an admin-managed mock account, also notify the owning admin.
  const { data: managedRecipient } = await (supabaseAdmin as any)
    .from("admin_managed_accounts")
    .select("created_by_admin, access_mode")
    .eq("user_id", otherUserId)
    .in("access_mode", ["internal_only", "external_password"])
    .maybeSingle();

  const ownerAdminId = (managedRecipient as any)?.created_by_admin as string | null | undefined;
  if (ownerAdminId && ownerAdminId !== userId) {
    await (supabaseAdmin.from("notifications") as any).insert({
      user_id: ownerAdminId,
      type: "system",
      title: "New message for your mock user",
      message: "A mock account managed by you received a new conversation message.",
      data: {
        kind: "mock_user_new_message",
        conversation_id: conversation.short_id || conversation.id,
        mock_user_id: otherUserId,
      },
    });
  }

  return data({ success: true });
}

export default function Conversation() {
  const { t } = useI18n();
  const { user, conversation, isBlocked, isBlockedByOther, hasOlderMessages: initialHasOlderMessages } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const olderMessagesFetcher = useFetcher<{ messages: any[]; hasOlderMessages?: boolean }>();
  const formRef = useRef<HTMLFormElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(initialHasOlderMessages);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSubmitting = navigation.state === "submitting";
  const userId = (user as any).id as string;

  const otherUser =
    conversation.participant_1 === userId
      ? conversation.participant2
      : conversation.participant1;

  // Use realtime messages hook - pass messages directly, hook handles deduplication
  const { messages: realtimeMessages, setMessages } = useRealtimeMessages({
    conversationId: conversation.id,
    initialMessages: conversation.messages || [],
    currentUserId: userId,
  });
  const conversationApiId = conversation.short_id || conversation.id;

  // Use translation hook for automatic message translation
  const { getDisplayContent, showOriginalAll, toggleShowOriginalAll } = useTranslation({
    userId,
    messages: realtimeMessages,
    enabled: true,
  });

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Function to add optimistic message
  const addOptimisticMessage = (content: string) => {
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: conversation.id,
      sender_id: userId,
      content: content,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [...prev, optimisticMessage]);
  };

  useEffect(() => {
    if (
      navigation.state === "idle" &&
      actionData &&
      "success" in actionData &&
      actionData.success
    ) {
      formRef.current?.reset();
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      setIsMenuOpen(false);
    }
  }, [navigation.state, actionData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [realtimeMessages]);

  useEffect(() => {
    setHasOlderMessages(initialHasOlderMessages);
  }, [conversation.id, initialHasOlderMessages]);

  useEffect(() => {
    if (olderMessagesFetcher.state !== "idle") return;
    if (!olderMessagesFetcher.data?.messages) return;

    const olderMessages = olderMessagesFetcher.data.messages || [];
    if (olderMessages.length > 0) {
      setMessages((current) => {
        const existingIds = new Set(current.map((m: any) => m.id));
        const merged = [...olderMessages.filter((m: any) => !existingIds.has(m.id)), ...current];
        return merged.sort(
          (a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
    }

    if (typeof olderMessagesFetcher.data.hasOlderMessages === "boolean") {
      setHasOlderMessages(olderMessagesFetcher.data.hasOlderMessages);
    }
  }, [olderMessagesFetcher.data, olderMessagesFetcher.state, setMessages]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
  };
  const hasTranslatableMessages = realtimeMessages.some(
    (message: any) => message.sender_id !== userId && message.message_type !== "heart"
  );
  const showGlobalTranslationToggle = true;
  const errorMessage =
    actionData && "errorKey" in actionData
      ? actionData.errorKey === "blocked_send"
        ? (isBlockedByOther ? t("messages.blocked_by_other_send") : t("messages.blocked_send"))
        : t(`messages.error.${actionData.errorKey}` as any)
      : null;

  return (
    <div className="flex-1 flex flex-col bg-white/85 backdrop-blur-[1px] md:rounded-r-3xl overflow-hidden">
      {/* Header conversazione */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-200 bg-white/85 h-[72px]">
        {/* Back button (mobile only) */}
        <Link
          to="/messages"
          className="md:hidden text-gray-400 hover:text-gray-600 flex-shrink-0"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div className="min-w-0 flex items-center gap-1">
              <p className="text-[15px] md:text-base font-semibold text-gray-900 truncate">
                {getPublicDisplayName(otherUser) || t("messages.user")}
              </p>
              {otherUser?.is_verified && (
                <svg
                  className="h-4 w-4 text-brand-500 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {isBlocked && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full ml-1 flex-shrink-0">
                  {t("messages.blocked")}
                </span>
              )}
            </div>
            <Link
              to={`/listings/${conversation.listing?.id}`}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-gray-100 transition-colors"
              title={conversation.listing?.title || ""}
            >
              <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="truncate">{conversation.listing?.title || t("messages.listing")}</span>
            </Link>
          </div>
        </div>

        {/* Menu 3 puntini */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-3 -m-1 text-gray-900 hover:text-black hover:bg-gray-100 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors duration-150"
          >
            <svg
              className="h-5 w-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 origin-top-right transition-all duration-150">
              {/* Block/Unblock */}
              <Form method="post">
                <input type="hidden" name="intent" value={isBlocked ? "unblock" : "block"} />
                <button
                  type="submit"
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  {isBlocked ? t("messages.unblock_user") : t("messages.block_user")}
                </button>
              </Form>

              {/* Report */}
              <Link
                to={`/report?type=user&id=${otherUser?.id}&from=conversation`}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setIsMenuOpen(false)}
              >
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {t("messages.report")}
              </Link>

              <div className="border-t border-gray-100 my-1" />

              {/* Delete */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setShowDeleteConfirm(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {t("messages.delete_conversation")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900">{t("messages.delete_question")}</h3>
            <p className="mt-2 text-sm text-gray-600">
              {t("messages.delete_text")}
            </p>
            <div className="mt-4 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary"
              >
                {t("messages.cancel")}
              </button>
              <Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <button type="submit" className="btn-primary bg-red-600 hover:bg-red-700">
                  {t("messages.delete")}
                </button>
              </Form>
            </div>
          </div>
        </div>
      )}

      {/* Area messaggi scrollabile */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-4">
        <div className="space-y-4">
          {hasOlderMessages && (
            <div className="pt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  const oldestMessage = realtimeMessages?.[0];
                  if (!oldestMessage?.created_at) return;
                  const before = encodeURIComponent(oldestMessage.created_at);
                  olderMessagesFetcher.load(`/api/messages/${conversationApiId}?before=${before}&limit=${MESSAGE_PAGE_SIZE}`);
                }}
                disabled={olderMessagesFetcher.state !== "idle"}
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-xs md:text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200 md:hover:-translate-y-[1px] md:hover:shadow-sm disabled:opacity-60"
              >
                {olderMessagesFetcher.state !== "idle" ? t("messages.loading_older") : t("messages.load_older")}
              </button>
            </div>
          )}

          {realtimeMessages?.map((message: any, index: number) => {
            const isOwnMessage = message.sender_id === userId;
            const messageDate = new Date(message.created_at);
            const prevMessage = realtimeMessages[index - 1];
            const prevDate = prevMessage ? new Date(prevMessage.created_at) : null;
            const isHeartMessage = message.message_type === "heart";

            // Check if we need a date separator
            const showDateSeparator = !prevDate ||
              messageDate.toDateString() !== prevDate.toDateString();

            // Smart timestamp: show time only if it's the first message or
            // more than 5 minutes since previous message from same sender
            const prevMessageFromSameSender = prevMessage?.sender_id === message.sender_id;
            const timeDiffMinutes = prevDate
              ? (messageDate.getTime() - prevDate.getTime()) / 60000
              : Infinity;
            const showTimestamp = !prevMessageFromSameSender || timeDiffMinutes > 5 || showDateSeparator;

            const currentDisplayContent = getDisplayContent(message);

            return (
              <div key={message.id}>
                {/* Date separator */}
                {showDateSeparator && (
                  <div className="flex items-center gap-4 my-4">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 font-medium">
                      {messageDate.toLocaleDateString([], {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}

                {/* Heart notification message */}
                {isHeartMessage ? (
                  <div className="my-4 flex justify-center">
                    <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-4 py-2 text-sm shadow-sm">
                      <svg className="h-4 w-4 flex-shrink-0 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                      <span className="truncate text-gray-700">
                        {t("messages.listing_saved")} · {t("messages.start_conversation")}
                      </span>
                    </div>
                  </div>
                ) : (
                  (() => {
                    return (
                      <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                        {/* Avatar for received messages */}
                        {!isOwnMessage && (
                          <div className="mr-2 flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
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
                        )}

                        <div className={`flex flex-col ${isOwnMessage ? "items-end" : "items-start"} max-w-[85%] md:max-w-[70%]`}>
                          {/* Message bubble */}
                          <div
                            className={`rounded-2xl px-4 py-2.5 ${
                              isOwnMessage
                                ? "bg-accent-100/90 border border-accent-200 text-gray-900 rounded-br-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                                : "bg-white/92 border border-gray-200 text-gray-900 rounded-bl-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                            } transition-colors duration-200`}
                          >
                          {/* Message content */}
                          <p className="whitespace-pre-wrap break-words">
                            {currentDisplayContent.content}
                          </p>

                          {/* Translation loading indicator inside bubble */}
                          {currentDisplayContent.isLoading && (
                            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400">
                              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                              </svg>
                              <span>{t("messages.translating")}</span>
                            </div>
                          )}
                        </div>

                        {/* Timestamp and translation toggle - outside bubble */}
                        {(showTimestamp || isOwnMessage) && (
                          <div
                            className={`flex items-center gap-2 text-xs mt-1 px-1 ${
                              isOwnMessage ? "flex-row-reverse" : "flex-row"
                            }`}
                          >
                            {/* Timestamp */}
                            {showTimestamp && (
                              <span className={isOwnMessage ? "text-accent-600" : "text-gray-500"}>
                                {messageDate.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            )}

                            {/* Read receipt for own messages */}
                            {isOwnMessage && (
                              <span className="flex items-center">
                                {message.read_at ? (
                                  <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                                  </svg>
                                )}
                              </span>
                            )}

                            {/* Translation toggle moved to composer area */}
                          </div>
                        )}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Campo risposta */}
      <div
        className={
          showGlobalTranslationToggle
            ? "px-2 pt-0 pb-3 md:px-4 md:pt-0 md:pb-4 bg-white/88 backdrop-blur-[1px] shadow-[0_-6px_14px_rgba(15,23,42,0.05)]"
            : "border-t border-gray-200 px-2 pt-4 pb-3 md:p-4 bg-white/88 backdrop-blur-[1px] shadow-[0_-6px_14px_rgba(15,23,42,0.05)]"
        }
      >
        {showGlobalTranslationToggle && (
          <div className="-mx-2 md:-mx-4 mb-3">
            <div
              role="button"
              tabIndex={0}
              aria-disabled={!hasTranslatableMessages}
              onClick={() => {
                if (!hasTranslatableMessages) return;
                toggleShowOriginalAll();
              }}
              onKeyDown={(event) => {
                if (!hasTranslatableMessages) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleShowOriginalAll();
                }
              }}
              className={`w-full border-y px-4 py-2.5 text-center text-xs font-medium transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 ${
                !hasTranslatableMessages
                  ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                  : showOriginalAll
                  ? "border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100"
                  : "cursor-pointer active:scale-[0.995] border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                <span>
                  {hasTranslatableMessages
                    ? showOriginalAll
                      ? t("messages.show_translation")
                      : t("messages.show_original")
                    : t("messages.show_original")}
                </span>
              </span>
            </div>
          </div>
        )}

        {errorMessage && (
          <p className="text-sm text-red-600 mb-2">{errorMessage}</p>
        )}
        {isBlocked || isBlockedByOther ? (
          <p className="text-sm text-gray-500 text-center py-2">
            {isBlockedByOther ? t("messages.blocked_by_other_send") : t("messages.blocked_send")}
          </p>
        ) : (
          <Form
            ref={formRef}
            method="post"
            className="flex gap-2 md:gap-3 items-end"
            onSubmit={() => {
              // Add message immediately (optimistic update)
              const content = textareaRef.current?.value;
              if (content?.trim()) {
                addOptimisticMessage(content.trim());
              }
            }}
          >
            <textarea
              ref={textareaRef}
              name="content"
              placeholder={t("messages.write_placeholder")}
              autoComplete="off"
              required
              rows={1}
              className="input flex-1 resize-none py-2 md:py-3 px-3 md:px-4 min-h-[40px] md:min-h-[48px] max-h-[150px] overflow-hidden rounded-full"
              disabled={isSubmitting}
              onChange={handleTextareaChange}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                if (event.shiftKey) return;
                if (event.nativeEvent.isComposing) return;

                event.preventDefault();
                if (!isSubmitting) {
                  formRef.current?.requestSubmit();
                }
              }}
            />
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary px-2 md:px-4 h-10 md:h-12 flex items-center justify-center rounded-full transition-all duration-200 md:hover:-translate-y-[1px] md:hover:shadow-md disabled:transform-none"
              >
              {isSubmitting ? (
                <svg
                  className="animate-spin h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              )}
            </button>
          </Form>
        )}
      </div>
    </div>
  );
}
