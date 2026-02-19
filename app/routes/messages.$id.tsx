import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigation, useNavigate } from "react-router";
import { useEffect, useRef, useState } from "react";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { useRealtimeMessages } from "~/hooks/useRealtimeMessages";
import { useTranslation } from "~/hooks/useTranslation";
import { getAvatarClasses } from "~/lib/avatarColors";
import { applyConversationPublicIdFilter } from "~/lib/conversation.server";

export const meta: MetaFunction = () => {
  return [{ title: "Conversation - Runoot" }];
};

// Helper: genera slug dal nome evento (fallback se slug è null)
function getEventSlug(event: { name: string; slug: string | null } | null): string {
  if (!event) return "";
  if (event.slug) return event.slug;
  return event.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

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
      participant1:profiles!conversations_participant_1_fkey(id, full_name, company_name, user_type, is_verified),
      participant2:profiles!conversations_participant_2_fkey(id, full_name, company_name, user_type, is_verified),
      messages(id, content, sender_id, created_at, read_at, message_type, detected_language, translated_content, translated_to)
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

  // Check if user already blocked the other participant
  const otherUserId = conversation.participant_1 === userId 
    ? conversation.participant_2 
    : conversation.participant_1;

  const { data: blockData } = await supabaseAdmin
    .from("blocked_users")
    .select("id")
    .eq("blocker_id", userId)
    .eq("blocked_id", otherUserId)
    .single();

  const isBlocked = !!blockData;

  const unreadMessageIds = conversation.messages
    ?.filter((m: any) => m.sender_id !== userId && !m.read_at)
    .map((m: any) => m.id);

  if (unreadMessageIds?.length > 0) {
    const now = new Date().toISOString();
    conversation.messages = conversation.messages.map((m: any) => {
      if (unreadMessageIds.includes(m.id)) {
        return { ...m, read_at: now };
      }
      return m;
    });

    await (supabaseAdmin.from("messages") as any)
      .update({ read_at: now })
      .in("id", unreadMessageIds);
  }

  // Keep menu badges in sync: opening a conversation consumes related "new message" notifications
  await (supabaseAdmin.from("notifications") as any)
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("type", "system")
    .filter("data->>kind", "eq", "new_message")
    .filter("data->>conversation_id", "eq", conversation.id)
    .is("read_at", null);

  const sortedMessages = [...(conversation.messages || [])].sort(
    (a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return {
    user,
    conversation: { ...conversation, messages: sortedMessages },
    isBlocked,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const userId = (user as any).id as string;
  const publicConversationId = params.id;

  if (!publicConversationId) {
    return data({ error: "Conversation not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  // Get conversation to verify participation
  const conversationQuery = supabaseAdmin
    .from("conversations")
    .select("id, participant_1, participant_2, listing_id, activated, listing:listings(author_id, title)")
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
    return data({ error: "Unauthorized" }, { status: 403 });
  }

  const otherUserId = conversation.participant_1 === userId
    ? conversation.participant_2
    : conversation.participant_1;

  const isListingOwner = conversation.listing?.author_id === userId;

  // Handle different actions
  if (intent === "block") {
    const { error } = await supabaseAdmin.from("blocked_users").insert({
      blocker_id: userId,
      blocked_id: otherUserId,
    } as any);

    if (error && !error.message.includes("duplicate")) {
      return data({ error: "Failed to block user" }, { status: 500 });
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

  if (typeof content !== "string" || !content.trim()) {
    return data({ error: "Message cannot be empty" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("messages").insert({
    conversation_id: conversation.id,
    sender_id: userId,
    content: content.trim(),
    message_type: "user",
  } as any);

  if (error) {
    return data({ error: "Failed to send message" }, { status: 500 });
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

  return data({ success: true });
}

export default function Conversation() {
  const { user, conversation, isBlocked } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSubmitting = navigation.state === "submitting";
  const userId = (user as any).id as string;

  const otherUser =
    conversation.participant_1 === userId
      ? conversation.participant2
      : conversation.participant1;

  // Event logo path - try multiple formats
  const eventSlug = getEventSlug(conversation.listing?.event);
  const [logoFormat, setLogoFormat] = useState<'png' | 'jpg' | 'webp' | null>('png');
  const logoPath = logoFormat ? `/logos/${eventSlug}.${logoFormat}` : null;

  // Use realtime messages hook - pass messages directly, hook handles deduplication
  const { messages: realtimeMessages, setMessages } = useRealtimeMessages({
    conversationId: conversation.id,
    initialMessages: conversation.messages || [],
    currentUserId: userId,
  });

  // Use translation hook for automatic message translation
  const { getDisplayContent, toggleShowOriginal } = useTranslation({
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

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
  };

  return (
    <div className="flex-1 flex flex-col bg-white/95 backdrop-blur-sm md:rounded-r-lg overflow-hidden">
      {/* Header conversazione */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-200 h-[72px]">
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

        {/* Event logo */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
          {logoPath ? (
            <img
              src={logoPath}
              alt={`${conversation.listing?.event?.name || 'Event'} logo`}
              className="w-full h-full object-contain p-0.5"
              onError={() => {
                // Try next format: png -> jpg -> webp -> null
                if (logoFormat === 'png') setLogoFormat('jpg');
                else if (logoFormat === 'jpg') setLogoFormat('webp');
                else setLogoFormat(null);
              }}
            />
          ) : (
            <span className="text-xs font-semibold text-gray-400">
              {conversation.listing?.event?.name?.substring(0, 2).toUpperCase() || '?'}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 truncate flex items-center gap-1">
            {otherUser?.company_name || otherUser?.full_name || "User"}
            {otherUser?.is_verified && (
              <svg
                className="h-4 w-4 text-brand-500"
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
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full ml-2">
                Blocked
              </span>
            )}
          </p>
          <Link
            to={`/listings/${conversation.listing?.id}`}
            className="text-sm text-brand-600 hover:text-brand-700 truncate block"
          >
            {conversation.listing?.title}
          </Link>
        </div>

        {/* Menu 3 puntini */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-3 -m-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
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
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
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
                  {isBlocked ? "Unblock user" : "Block user"}
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
                Report
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
                Delete conversation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900">Delete conversation?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This conversation will be removed from your inbox. The other user will still be able to see it.
            </p>
            <div className="mt-4 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <button type="submit" className="btn-primary bg-red-600 hover:bg-red-700">
                  Delete
                </button>
              </Form>
            </div>
          </div>
        </div>
      )}

      {/* Area messaggi scrollabile */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-4">
        <div className="space-y-3">
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

            // Show translation indicator only once per group of consecutive translated messages from same sender
            const currentDisplayContent = getDisplayContent(message);
            const prevDisplayContent = prevMessage ? getDisplayContent(prevMessage) : null;
            const prevWasTranslatedFromSameSender = prevMessageFromSameSender &&
              prevDisplayContent?.canToggle &&
              !showTimestamp; // Reset on new timestamp group
            const showTranslationIndicator = currentDisplayContent.canToggle && !prevWasTranslatedFromSameSender;

            return (
              <div key={message.id}>
                {/* Date separator */}
                {showDateSeparator && (
                  <div className="flex items-center gap-4 my-6">
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
                  <div className="flex justify-center my-6">
                    <div className="border border-gray-200 bg-white rounded-2xl px-6 py-4 text-center max-w-sm shadow-sm">
                      <div className="flex justify-center mb-2">
                        <svg className="h-8 w-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                      </div>
                      <p className="text-gray-800 font-medium">
                        Your listing caught someone's eye
                      </p>
                      <p className="text-gray-500 text-sm mt-1">
                        This user saved your listing. Start a conversation.
                      </p>
                    </div>
                  </div>
                ) : (
                  (() => {
                    return (
                      <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                        {/* Avatar for received messages */}
                        {!isOwnMessage && (
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold mr-2 ${getAvatarClasses(otherUser?.id || "", otherUser?.user_type)}`}>
                            {otherUser?.company_name?.charAt(0) ||
                              otherUser?.full_name?.charAt(0) ||
                              "?"}
                          </div>
                        )}

                        <div className={`flex flex-col ${isOwnMessage ? "items-end" : "items-start"} max-w-[85%] md:max-w-[70%]`}>
                          {/* Message bubble */}
                          <div
                            className={`rounded-2xl px-4 py-2.5 ${
                              isOwnMessage
                                ? "bg-accent-100 text-gray-900 rounded-br-md"
                                : "bg-gray-200 text-gray-900 rounded-bl-md"
                            }`}
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
                              <span>Translating...</span>
                            </div>
                          )}
                        </div>

                        {/* Timestamp and translation toggle - outside bubble */}
                        {(showTimestamp || isOwnMessage || showTranslationIndicator) && (
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

                            {/* Translation toggle */}
                            {showTranslationIndicator && (
                              <button
                                type="button"
                                onClick={() => toggleShowOriginal(message.id)}
                                className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                                </svg>
                                <span>
                                  {currentDisplayContent.showOriginal
                                    ? "Show translation"
                                    : "Auto-translated • Show original"
                                  }
                                </span>
                              </button>
                            )}
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
      <div className="border-t border-gray-200 px-2 pt-4 pb-3 md:p-4 bg-white">
        {actionData && "error" in actionData && (
          <p className="text-sm text-red-600 mb-2">{actionData.error}</p>
        )}
        {isBlocked ? (
          <p className="text-sm text-gray-500 text-center py-2">
            You have blocked this user. Unblock to send messages.
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
              placeholder="Write a message... (Shift+Return for new line)"
              autoComplete="off"
              required
              rows={1}
              className="input flex-1 resize-none py-2 md:py-3 px-3 md:px-4 min-h-[40px] md:min-h-[48px] max-h-[150px] overflow-hidden rounded-2xl"
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
              className="btn-primary px-2 md:px-4 h-10 md:h-12 flex items-center justify-center rounded-2xl"
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
