import { useEffect, useState, useRef } from "react";
import { useFetcher } from "@remix-run/react";

interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  listing_id: string;
  updated_at: string;
  listing?: {
    id: string;
    title: string;
    listing_type: string;
  };
  participant1?: {
    id: string;
    full_name: string | null;
    company_name: string | null;
    user_type: string;
  };
  participant2?: {
    id: string;
    full_name: string | null;
    company_name: string | null;
    user_type: string;
  };
  messages?: {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
    read_at: string | null;
  }[];
}

interface UseRealtimeConversationsOptions {
  userId: string;
  initialConversations: Conversation[];
}

// Polling interval in milliseconds
const POLL_INTERVAL = 5000;

export function useRealtimeConversations({
  userId,
  initialConversations,
}: UseRealtimeConversationsOptions) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const fetcher = useFetcher<{ conversations: Conversation[] }>();
  const isPollingRef = useRef(false);

  // Update when initial conversations change
  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  // Sync with fetcher data
  useEffect(() => {
    if (fetcher.data?.conversations && fetcher.state === "idle") {
      setConversations(fetcher.data.conversations);
    }
  }, [fetcher.data, fetcher.state]);

  // Polling effect
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    const poll = () => {
      if (isPollingRef.current) return;
      if (fetcher.state !== "idle") return;

      isPollingRef.current = true;
      fetcher.load("/api/conversations");
      isPollingRef.current = false;
    };

    const intervalId = setInterval(poll, POLL_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [userId, fetcher]);

  return { conversations, setConversations };
}
