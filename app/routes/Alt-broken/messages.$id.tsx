import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigation, useNavigate } from "react-router";
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
      \`
      *,
      listing:listings(id, title, listing_type, status),
      participant1:profiles!conversations_participant_1_fkey(id, full_name, company_name, user_type, is_verified),
      participant2:profiles!conversations_participant_2_fkey(id, full_name, company_name, user_type, is_verified),
      messages(id, content, sender_id, created_at, read_at, message_type)
    \`
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
    return data({ error: "Unauthorized" }, { status: 403 });
  }

  const otherUserId = conversation.participant_1 === userId
    ? conversation.participant_2
    : conversation.participant_1;

  const isListingOwner = conversation.listing?.author_id === userId;

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
    const isParticipant1 = conversation.participant_1 === userId;

    await (supabaseAdmin.from("conversations") as any)
      .update(isParticipant1 ? { deleted_by_1: true } : { deleted_by_2: true })
      .eq("id", id!);

    return redirect("/messages");
  }

  const content = formData.get("content");

  if (typeof content !== "string" || !content.trim()) {
    return data({ error: "Message cannot be empty" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("messages").insert({
    conversation_id: id!,
    sender_id: userId,
    content: content.trim(),
    message_type: "user",
  } as any);

  if (error) {
    return data({ error: "Failed to send message" }, { status: 500 });
  }

  if (isListingOwner && !conversation.activated) {
    await (supabaseAdmin.from("conversations") as any)
      .update({ activated: true, updated_at: new Date().toISOString() })
      .eq("id", id!);
  } else {
    await (supabaseAdmin.from("conversations") as any)
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id!);
  }

  return data({ success: true });
}

const listingTypeConfig = {
  room: {
    bg: "bg-emerald-500",
    bgLight: "bg-emerald-100",
    text: "text-emerald-700",
    label: "Room",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  bib: {
    bg: "bg-orange-500",
    bgLight: "bg-orange-100",
    text: "text-orange-700",
    label: "Bib",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
  },
  room_and_bib: {
    bg: "bg-blue-500",
    bgLight: "bg-blue-100",
    text: "text-blue-700",
    label: "Package",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
};

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

  const { messages: realtimeMessages, setMessages } = useRealtimeMessages({
    conversationId: conversation.id,
    initialMessages: conversation.messages || [],
    currentUserId: userId,
  });

  const listingConfig = listingTypeConfig[conversation.listing?.listing_type as keyof typeof listingTypeConfig] || listingTypeConfig.room;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addOptimisticMessage = (content: string) => {
    const optimisticMessage = {
      id: \`temp-\${Date.now()}\`,
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
    <div className="flex-1 flex flex-col bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Hero Header Banner */}
      <div className="relative bg-gradient-to-br from-stone-900 via-stone-800 to-emerald-900 overflow-hidden">
        {/* Pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: \`url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")\`,
          }}
        />
        {/* Gradient orbs */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-teal-500/20 rounded-full blur-2xl" />

        <div className="relative px-5 py-4">
          <div className="flex items-center gap-4">
            {/* Back button (mobile only) */}
            <Link
              to="/messages"
              className="md:hidden p-2 -ml-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>

            {/* User Avatar */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-lg shadow-emerald-500/30 border-2 border-white/20">
              {otherUser?.company_name?.charAt(0) ||
                otherUser?.full_name?.charAt(0) ||
                "?"}
            </div>

            {/* User Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-white truncate">
                  {otherUser?.company_name || otherUser?.full_name || "User"}
                </p>
                {otherUser?.is_verified && (
                  <div className="w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {isBlocked && (
                  <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-medium border border-red-500/30">
                    Blocked
                  </span>
                )}
              </div>

              {/* Listing Link */}
              <Link
                to={\`/listings/\${conversation.listing?.id}\`}
                className="inline-flex items-center gap-2 mt-1 group"
              >
                <span className={\`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium \${listingConfig.bgLight} \${listingConfig.text}\`}>
                  {listingConfig.icon}
                  {listingConfig.label}
                </span>
                <span className="text-sm text-white/60 group-hover:text-white truncate transition-colors">
                  {conversation.listing?.title}
                </span>
                <svg className="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
            </div>

            {/* Menu Button */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={\`p-2.5 rounded-xl transition-colors \${
                  isMenuOpen
                    ? "bg-white/20 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }\`}
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-stone-100 py-2 z-50 overflow-hidden">
                  {/* Block/Unblock */}
                  <Form method="post">
                    <input type="hidden" name="intent" value={isBlocked ? "unblock" : "block"} />
                    <button
                      type="submit"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center">
                        <svg className="h-4 w-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </div>
                      {isBlocked ? "Unblock user" : "Block user"}
                    </button>
                  </Form>

                  {/* Report */}
                  <Link
                    to={\`/report?type=user&id=\${otherUser?.id}&from=conversation\`}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    Report user
                  </Link>

                  <div className="border-t border-stone-100 my-2" />

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setShowDeleteConfirm(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                      <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                    Delete conversation
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-stone-900 text-center">Delete conversation?</h3>
            <p className="mt-2 text-sm text-stone-500 text-center">
              This conversation will be removed from your inbox. The other user will still be able to see it.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <Form method="post" className="flex-1">
                <input type="hidden" name="intent" value="delete" />
                <button
                  type="submit"
                  className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
                >
                  Delete
                </button>
              </Form>
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 bg-stone-50">
        <div className="space-y-4">
          {realtimeMessages?.map((message: any, index: number) => {
            const isOwnMessage = message.sender_id === userId;
            const messageDate = new Date(message.created_at);
            const prevMessage = realtimeMessages[index - 1];
            const prevDate = prevMessage ? new Date(prevMessage.created_at) : null;
            const isHeartMessage = message.message_type === "heart";

            const showDateSeparator = !prevDate ||
              messageDate.toDateString() !== prevDate.toDateString();

            return (
              <div key={message.id}>
                {/* Date Separator */}
                {showDateSeparator && (
                  <div className="flex items-center gap-4 my-6">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-stone-200 to-transparent" />
                    <span className="text-xs text-stone-400 font-medium px-3 py-1 bg-white rounded-full border border-stone-100 shadow-sm">
                      {messageDate.toLocaleDateString([], {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-stone-200 to-transparent" />
                  </div>
                )}

                {/* Heart Notification Message */}
                {isHeartMessage ? (
                  <div className="flex justify-center my-6">
                    <div className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100 rounded-2xl px-6 py-5 text-center max-w-sm shadow-sm">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
                        <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                      </div>
                      <p className="text-stone-800 font-semibold">
                        Your listing caught someone's eye
                      </p>
                      <p className="text-stone-500 text-sm mt-1">
                        This user saved your listing. Start a conversation!
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Regular Message */
                  <div className={\`flex \${isOwnMessage ? "justify-end" : "justify-start"}\`}>
                    <div
                      className={\`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm \${
                        isOwnMessage
                          ? "bg-white text-stone-900 rounded-br-md border border-stone-100"
                          : "bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-bl-md shadow-md shadow-emerald-500/20"
                      }\`}
                    >
                      <p className="whitespace-pre-wrap break-words leading-relaxed">
                        {message.content}
                      </p>
                      <div
                        className={\`flex items-center justify-end gap-1.5 text-xs mt-2 \${
                          isOwnMessage ? "text-stone-400" : "text-white/70"
                        }\`}
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
                              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-stone-300" fill="currentColor" viewBox="0 0 24 24">
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

      {/* Input Area */}
      <div className="border-t border-stone-100 p-4 bg-white">
        {actionData && "error" in actionData && (
          <div className="mb-3 p-3 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-sm text-red-600">{actionData.error}</p>
          </div>
        )}

        {isBlocked ? (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-stone-100 rounded-xl">
              <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span className="text-sm text-stone-500">You have blocked this user. Unblock to send messages.</span>
            </div>
          </div>
        ) : (
          <Form
            ref={formRef}
            method="post"
            className="flex gap-3 items-end"
            onSubmit={() => {
              const content = textareaRef.current?.value;
              if (content?.trim()) {
                addOptimisticMessage(content.trim());
              }
            }}
          >
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                name="content"
                placeholder="Type your message..."
                autoComplete="off"
                required
                rows={1}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl resize-none min-h-[48px] max-h-[150px] overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                disabled={isSubmitting}
                onKeyDown={handleKeyDown}
                onChange={handleTextareaChange}
              />
              <p className="absolute right-3 bottom-1 text-[10px] text-stone-300">
                Shift+Enter for new line
              </p>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-12 h-12 flex-shrink-0 bg-gradient-to-br from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl flex items-center justify-center transition-all shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 disabled:opacity-50"
            >
              {isSubmitting ? (
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
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
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
            </button>
          </Form>
        )}
      </div>
    </div>
  );
}
