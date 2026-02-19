import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, hasBrowserAccessToken } from "~/lib/supabase.client";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  message_type?: "user" | "system" | "heart";
  detected_language?: string | null;
  translated_content?: string | null;
  translated_to?: string | null;
}

interface UseRealtimeMessagesOptions {
  conversationId: string;
  initialMessages: Message[];
  currentUserId: string;
  onNewMessage?: (message: Message) => void;
}

const FALLBACK_POLL_INTERVAL = 15000;
const shouldDisableRealtime =
  typeof window !== "undefined" &&
  window.location.hostname === "localhost" &&
  /firefox/i.test(navigator.userAgent);

function playNotificationSound() {
  if (typeof window === "undefined") return;

  try {
    const audio = new Audio("/ding-sound.mp3");
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch {
    // Ignore browser audio restrictions
  }
}

function sortByCreatedAt(messages: Message[]) {
  return [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export function useRealtimeMessages({
  conversationId,
  initialMessages,
  currentUserId,
  onNewMessage,
}: UseRealtimeMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>(sortByCreatedAt(initialMessages));
  const [isConnected, setIsConnected] = useState(false);
  const fetcher = useFetcher<{ messages: Message[] }>();

  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    setMessages(sortByCreatedAt(initialMessages));
  }, [conversationId, initialMessages]);

  useEffect(() => {
    if (!fetcher.data?.messages || fetcher.state !== "idle") return;

    const serverMessages = sortByCreatedAt(fetcher.data.messages);

    setMessages((currentMessages) => {
      const tempMessages = currentMessages.filter((m) => m.id.startsWith("temp-"));

      const unconfirmedTempMessages = tempMessages.filter((tempMsg) => {
        const isConfirmed = serverMessages.some(
          (serverMsg) =>
            serverMsg.sender_id === tempMsg.sender_id &&
            serverMsg.content === tempMsg.content
        );
        return !isConfirmed;
      });

      return sortByCreatedAt([...serverMessages, ...unconfirmedTempMessages]);
    });
  }, [fetcher.data, fetcher.state]);

  useEffect(() => {
    if (!conversationId || typeof window === "undefined") return;
    if (shouldDisableRealtime || !hasBrowserAccessToken()) {
      setIsConnected(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    setIsConnected(false);

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;

          setMessages((currentMessages) => {
            if (currentMessages.some((m) => m.id === newMessage.id)) {
              return currentMessages;
            }

            const withoutConfirmedTemp = currentMessages.filter((m) => {
              if (!m.id.startsWith("temp-")) return true;
              return !(
                m.sender_id === newMessage.sender_id &&
                m.content === newMessage.content
              );
            });

            return sortByCreatedAt([...withoutConfirmedTemp, newMessage]);
          });

          if (newMessage.sender_id !== currentUserId) {
            onNewMessage?.(newMessage);
            playNotificationSound();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message;

          setMessages((currentMessages) =>
            currentMessages.map((m) =>
              m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m
            )
          );
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      setIsConnected(false);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, currentUserId, onNewMessage]);

  useEffect(() => {
    if (!conversationId || typeof window === "undefined") return;
    if (isConnected) return;

    const poll = () => {
      if (document.visibilityState !== "visible") return;
      if (fetcher.state !== "idle") return;

      fetcher.load(`/api/messages/${conversationId}`);
    };

    const onFocus = () => poll();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        poll();
      }
    };

    poll();
    const intervalId = setInterval(poll, FALLBACK_POLL_INTERVAL);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [conversationId, fetcher, isConnected]);

  return {
    messages,
    isConnected,
    setMessages,
  };
}
