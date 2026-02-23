import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, hasBrowserAccessToken } from "~/lib/supabase.client";

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
    author_id?: string;
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
    message_type?: "user" | "system" | "heart";
    translated_content?: string | null;
  }[];
}

interface UseRealtimeConversationsOptions {
  userId: string;
  initialConversations: Conversation[];
}

const FALLBACK_POLL_INTERVAL = 15000;
const REFRESH_DEBOUNCE_MS = 400;
const MIN_SYNC_INTERVAL_MS = 1200;
const shouldDisableRealtime =
  typeof window !== "undefined" &&
  window.location.hostname === "localhost" &&
  /firefox/i.test(navigator.userAgent);

export function useRealtimeConversations({
  userId,
  initialConversations,
}: UseRealtimeConversationsOptions) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [isConnected, setIsConnected] = useState(false);
  const fetcher = useFetcher<{ conversations: Conversation[] }>();

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pendingSyncRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncAtRef = useRef(0);

  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  useEffect(() => {
    if (fetcher.data?.conversations && fetcher.state === "idle") {
      setConversations(fetcher.data.conversations);
    }
  }, [fetcher.data, fetcher.state]);

  useEffect(() => {
    if (!pendingSyncRef.current) return;
    if (fetcher.state !== "idle") return;

    pendingSyncRef.current = false;
    lastSyncAtRef.current = Date.now();
    fetcher.load("/api/conversations");
  }, [fetcher, fetcher.state]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    if (shouldDisableRealtime || !hasBrowserAccessToken()) {
      setIsConnected(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    setIsConnected(false);

    const runSync = () => {
      if (document.visibilityState !== "visible") {
        pendingSyncRef.current = true;
        return;
      }

      if (fetcher.state !== "idle") {
        pendingSyncRef.current = true;
        return;
      }

      const now = Date.now();
      const elapsed = now - lastSyncAtRef.current;
      if (elapsed < MIN_SYNC_INTERVAL_MS) {
        pendingSyncRef.current = true;
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          if (fetcher.state === "idle") {
            pendingSyncRef.current = false;
            lastSyncAtRef.current = Date.now();
            fetcher.load("/api/conversations");
          }
        }, MIN_SYNC_INTERVAL_MS - elapsed);
        return;
      }

      lastSyncAtRef.current = now;
      fetcher.load("/api/conversations");
    };

    const requestSync = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(runSync, REFRESH_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`conversations:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        requestSync
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        requestSync
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversations",
        },
        requestSync
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
        },
        requestSync
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      setIsConnected(false);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, fetcher]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    if (isConnected) return;

    const poll = () => {
      if (document.visibilityState !== "visible") return;
      if (fetcher.state !== "idle") return;

      fetcher.load("/api/conversations");
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
  }, [fetcher, isConnected, userId]);

  return { conversations, setConversations, isConnected };
}
