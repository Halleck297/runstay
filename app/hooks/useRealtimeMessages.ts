import { useEffect, useState, useRef } from "react";
import { useFetcher } from "react-router";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

interface UseRealtimeMessagesOptions {
  conversationId: string;
  initialMessages: Message[];
  currentUserId: string;
  onNewMessage?: (message: Message) => void;
}

// Polling interval in milliseconds
const POLL_INTERVAL = 3000;

export function useRealtimeMessages({
  conversationId,
  initialMessages,
  currentUserId,
  onNewMessage,
}: UseRealtimeMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const fetcher = useFetcher<{ messages: Message[] }>();
  const isPollingRef = useRef(false);
  const previousMessageCountRef = useRef(initialMessages.length);

  // Update messages when conversation changes
  useEffect(() => {
    setMessages(initialMessages);
    previousMessageCountRef.current = initialMessages.length;
  }, [conversationId]);

  // Sync with fetcher data when it returns
  useEffect(() => {
    if (fetcher.data?.messages && fetcher.state === "idle") {
      const serverMessages = fetcher.data.messages;

      setMessages((currentMessages) => {
        // Get only temp messages (optimistic updates not yet confirmed)
        const tempMessages = currentMessages.filter(m => m.id.startsWith("temp-"));

        // Check if any temp message content matches a server message
        // If so, the temp message was confirmed - don't keep it
        const unconfirmedTempMessages = tempMessages.filter(tempMsg => {
          // A temp message is confirmed if there's a server message with same content
          // from the same sender, created around the same time
          const isConfirmed = serverMessages.some(serverMsg =>
            serverMsg.sender_id === tempMsg.sender_id &&
            serverMsg.content === tempMsg.content
          );
          return !isConfirmed;
        });

        // Notify about new messages from other users
        if (previousMessageCountRef.current < serverMessages.length) {
          const newServerMessages = serverMessages.slice(previousMessageCountRef.current);
          newServerMessages.forEach(msg => {
            if (msg.sender_id !== currentUserId) {
              onNewMessage?.(msg);
            }
          });
        }
        previousMessageCountRef.current = serverMessages.length;

        // Return server messages + any unconfirmed temp messages
        if (unconfirmedTempMessages.length > 0) {
          return [...serverMessages, ...unconfirmedTempMessages].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        }

        return serverMessages;
      });
    }
  }, [fetcher.data, fetcher.state, currentUserId, onNewMessage]);

  // Polling effect
  useEffect(() => {
    if (!conversationId || typeof window === "undefined") return;

    const poll = () => {
      if (isPollingRef.current) return;
      if (fetcher.state !== "idle") return;

      isPollingRef.current = true;
      fetcher.load(`/api/messages/${conversationId}`);
      isPollingRef.current = false;
    };

    // Start polling
    const intervalId = setInterval(poll, POLL_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [conversationId, fetcher]);

  return {
    messages,
    isConnected: true,
    setMessages,
  };
}
