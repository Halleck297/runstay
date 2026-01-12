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
} from "@remix-run/react";
import { useEffect, useRef } from "react";
import { requireUser } from "~/lib/session.server";
import { supabase } from "~/lib/supabase.server";
import { Header } from "~/components/Header";

export const meta: MetaFunction = () => {
  return [{ title: "Conversation - RunStay Exchange" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const { id } = params;

  // Get conversation with messages
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select(
      `
      *,
      listing:listings(id, title, listing_type, status),
      participant1:profiles!conversations_participant_1_fkey(id, full_name, company_name, user_type, is_verified),
      participant2:profiles!conversations_participant_2_fkey(id, full_name, company_name, user_type, is_verified),
      messages(id, content, sender_id, created_at, read_at)
    `
    )
    .eq("id", id)
    .single();

  if (error || !conversation) {
    throw new Response("Conversation not found", { status: 404 });
  }

  // Check user is participant
  if (
    conversation.participant_1 !== user.id &&
    conversation.participant_2 !== user.id
  ) {
    throw new Response("Unauthorized", { status: 403 });
  }

  // Mark unread messages as read
  const unreadMessageIds = conversation.messages
    ?.filter((m: any) => m.sender_id !== user.id && !m.read_at)
    .map((m: any) => m.id);

  if (unreadMessageIds?.length > 0) {
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadMessageIds);
  }

  // Sort messages by date
  const sortedMessages = [...(conversation.messages || [])].sort(
    (a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return {
    user,
    conversation: { ...conversation, messages: sortedMessages },
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const { id } = params;

  const formData = await request.formData();
  const content = formData.get("content");

  if (typeof content !== "string" || !content.trim()) {
    return json({ error: "Message cannot be empty" }, { status: 400 });
  }

  // Verify user is participant
  const { data: conversation } = await supabase
    .from("conversations")
    .select("participant_1, participant_2")
    .eq("id", id)
    .single();

  if (
    !conversation ||
    (conversation.participant_1 !== user.id &&
      conversation.participant_2 !== user.id)
  ) {
    return json({ error: "Unauthorized" }, { status: 403 });
  }

  // Create message
  const { error } = await supabase.from("messages").insert({
    conversation_id: id!,
    sender_id: user.id,
    content: content.trim(),
  });

  if (error) {
    return json({ error: "Failed to send message" }, { status: 500 });
  }

  // Update conversation timestamp
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  return json({ success: true });
}

export default function Conversation() {
  const { user, conversation } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const formRef = useRef<HTMLFormElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isSubmitting = navigation.state === "submitting";

  // Determine the other participant
  const otherUser =
    conversation.participant_1 === user.id
      ? conversation.participant2
      : conversation.participant1;

  // Clear form and scroll after sending
  useEffect(() => {
    if (navigation.state === "idle" && actionData?.success) {
      formRef.current?.reset();
    }
  }, [navigation.state, actionData]);

  // Scroll to bottom on load and new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.messages]);

  return (
    <div className="min-h-full bg-gray-50 flex flex-col">
      <Header user={user} />

      {/* Conversation header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              to="/messages"
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
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
              </p>
              <Link
                to={`/listings/${conversation.listing?.id}`}
                className="text-sm text-brand-600 hover:text-brand-700 truncate block"
              >
                Re: {conversation.listing?.title}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          {/* Listing info card */}
          <div className="mb-6 p-4 bg-gray-100 rounded-lg">
            <p className="text-sm text-gray-600">
              Conversation about:{" "}
              <Link
                to={`/listings/${conversation.listing?.id}`}
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                {conversation.listing?.title}
              </Link>
              {conversation.listing?.status !== "active" && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                  {conversation.listing?.status}
                </span>
              )}
            </p>
          </div>

          {/* Messages */}
          <div className="space-y-4">
            {conversation.messages?.map((message: any) => {
              const isOwnMessage = message.sender_id === user.id;

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      isOwnMessage
                        ? "bg-brand-600 text-white rounded-br-md"
                        : "bg-white border border-gray-200 text-gray-900 rounded-bl-md"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        isOwnMessage ? "text-brand-200" : "text-gray-400"
                      }`}
                    >
                      {new Date(message.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {isOwnMessage && message.read_at && (
                        <span className="ml-2">✓✓</span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Message input */}
      <div className="bg-white border-t border-gray-200">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          {actionData?.error && (
            <p className="text-sm text-red-600 mb-2">{actionData.error}</p>
          )}
          <Form ref={formRef} method="post" className="flex gap-3">
            <input
              type="text"
              name="content"
              placeholder="Type your message..."
              autoComplete="off"
              required
              className="input flex-1"
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-6"
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
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              )}
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
}
