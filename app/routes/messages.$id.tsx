import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useNavigate,
} from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { useRealtimeMessages } from "~/hooks/useRealtimeMessages";

export const meta: MetaFunction = () => {
  return [{ title: "Conversation - Runoot" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const userId = (user as any).id as string;
  const { id } = params;

  const { data: conversation, error } = await supabaseAdmin
    .from("conversations")
    .select(
      `
      *,
      listing:listings(id, title, listing_type, status),
      participant1:profiles!conversations_participant_1_fkey(id, full_name, company_name, user_type, is_verified),
      participant2:profiles!conversations_participant_2_fkey(id, full_name, company_name, user_type, is_verified),
      messages(id, content, sender_id, created_at, read_at, message_type)
    `
    )
    .eq("id", id!)
    .single<any>();

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

    (supabaseAdmin.from("messages") as any)
      .update({ read_at: now })
      .in("id", unreadMessageIds)
      .then(() => {});
  }

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
  const { id } = params;

  const formData = await request.formData();
  const intent = formData.get("intent");

  // Get conversation to verify participation
  const { data: conversation } = await supabaseAdmin
    .from("conversations")
    .select("participant_1, participant_2, activated, listing:listings(author_id)")
    .eq("id", id!)
    .single<{ participant_1: string; participant_2: string; activated: boolean; listing: { author_id: string } }>();

  if (
    !conversation ||
    (conversation.participant_1 !== userId &&
      conversation.participant_2 !== userId)
  ) {
    return json({ error: "Unauthorized" }, { status: 403 });
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
      return json({ error: "Failed to block user" }, { status: 500 });
    }

    return json({ success: true, action: "blocked" });
  }

  if (intent === "unblock") {
    await supabaseAdmin
      .from("blocked_users")
      .delete()
      .eq("blocker_id", userId)
      .eq("blocked_id", otherUserId);

    return json({ success: true, action: "unblocked" });
  }

  if (intent === "delete") {
    // Soft delete - mark as deleted for this user
    const isParticipant1 = conversation.participant_1 === userId;
    
    await (supabaseAdmin.from("conversations") as any)
      .update(isParticipant1 ? { deleted_by_1: true } : { deleted_by_2: true })
      .eq("id", id!);

    return redirect("/messages");
  }

  // Default: send message
  const content = formData.get("content");

  if (typeof content !== "string" || !content.trim()) {
    return json({ error: "Message cannot be empty" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("messages").insert({
    conversation_id: id!,
    sender_id: userId,
    content: content.trim(),
    message_type: "user",
  } as any);

  if (error) {
    return json({ error: "Failed to send message" }, { status: 500 });
  }

  // If the listing owner is replying and conversation is not activated, activate it
  if (isListingOwner && !conversation.activated) {
    await (supabaseAdmin.from("conversations") as any)
      .update({ activated: true, updated_at: new Date().toISOString() })
      .eq("id", id!);
  } else {
    await (supabaseAdmin.from("conversations") as any)
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id!);
  }

  return json({ success: true });
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

  // Use realtime messages hook - pass messages directly, hook handles deduplication
  const { messages: realtimeMessages, setMessages } = useRealtimeMessages({
    conversationId: conversation.id,
    initialMessages: conversation.messages || [],
    currentUserId: userId,
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
  };

  return (
    <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-r-lg overflow-hidden">
      {/* Header conversazione */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-200 bg-white h-[72px]">
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

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold flex-shrink-0">
          {otherUser?.company_name?.charAt(0) ||
            otherUser?.full_name?.charAt(0) ||
            "?"}
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
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
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
      <div className="flex-1 overflow-y-auto px-8 py-4">
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
                  <div
                    className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                        isOwnMessage
                          ? "bg-gray-200 text-gray-900 rounded-br-md"
                          : "bg-accent-500 text-white rounded-bl-md"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                      <div
                        className={`flex items-center justify-end gap-1.5 text-xs mt-1 ${
                          isOwnMessage ? "text-gray-500" : "text-accent-100"
                        }`}
                      >
                        <span>
                          {messageDate.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
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
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Campo risposta */}
      <div className="border-t border-gray-200 p-4 bg-white">
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
            className="flex gap-3 items-end"
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
              placeholder="Type your message... (Shift+Enter for new line)"
              autoComplete="off"
              required
              rows={1}
              className="input flex-1 resize-none py-3 min-h-[48px] max-h-[150px] overflow-hidden rounded-2xl"
              disabled={isSubmitting}
              onKeyDown={handleKeyDown}
              onChange={handleTextareaChange}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-4 h-12 flex items-center justify-center rounded-2xl"
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
