import { useEffect, useState } from "react";

interface UseUnreadCountOptions {
  userId: string;
  initialMessages: number;
  enabled?: boolean;
}

const POLL_INTERVAL_MS = 15000;

export function useUnreadCount({
  userId,
  initialMessages,
  enabled = true,
}: UseUnreadCountOptions) {
  const [unreadMessages, setUnreadMessages] = useState(initialMessages);

  useEffect(() => {
    setUnreadMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (!enabled || !userId || typeof window === "undefined") return;

    let disposed = false;

    const syncCount = async () => {
      if (document.visibilityState !== "visible") return;

      try {
        const response = await fetch("/api/unread", { credentials: "same-origin" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          unreadMessages?: number;
        };
        if (!disposed) {
          setUnreadMessages(payload.unreadMessages || 0);
        }
      } catch {
        // Ignore transient network errors; next poll will retry
      }
    };

    syncCount();
    const intervalId = setInterval(syncCount, POLL_INTERVAL_MS);

    const onFocus = () => syncCount();
    const onVisibility = () => {
      if (document.visibilityState === "visible") syncCount();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, userId]);

  return {
    unreadMessages,
    unreadCount: unreadMessages,
    setUnreadMessages,
  };
}
