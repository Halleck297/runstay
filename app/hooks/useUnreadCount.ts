import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "~/lib/supabase.client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UseUnreadCountOptions {
  userId: string;
  initialCount: number;
}

export function useUnreadCount({ userId, initialCount }: UseUnreadCountOptions) {
  const [unreadCount, setUnreadCount] = useState(initialCount);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    let channel: RealtimeChannel;

    const setupRealtime = () => {
      try {
        const supabase = getSupabaseBrowserClient();

        // Ascolta nuovi messaggi dove l'utente NON è il sender
        channel = supabase
          .channel(`unread:${userId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
            },
            async (payload) => {
              const newMessage = payload.new as {
                id: string;
                sender_id: string;
                conversation_id: string;
                read_at: string | null;
              };

              // Se il messaggio non è dell'utente corrente, incrementa il conteggio
              if (newMessage.sender_id !== userId && !newMessage.read_at) {
                // Verifica che l'utente sia partecipante della conversazione
                const { data: conversation } = await (supabase
                  .from("conversations") as any)
                  .select("participant_1, participant_2")
                  .eq("id", newMessage.conversation_id)
                  .single();

                if (
                  conversation &&
                  ((conversation as any).participant_1 === userId ||
                    (conversation as any).participant_2 === userId)
                ) {
                  setUnreadCount((prev) => prev + 1);
                }
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "messages",
            },
            (payload) => {
              const oldMessage = payload.old as { read_at: string | null };
              const newMessage = payload.new as {
                sender_id: string;
                read_at: string | null;
              };

              // Se un messaggio è stato marcato come letto
              if (
                !oldMessage.read_at &&
                newMessage.read_at &&
                newMessage.sender_id !== userId
              ) {
                setUnreadCount((prev) => Math.max(0, prev - 1));
              }
            }
          )
          .subscribe();
      } catch (error) {
        console.error("Error setting up unread count realtime:", error);
      }
    };

    setupRealtime();

    return () => {
      if (channel) {
        const supabase = getSupabaseBrowserClient();
        supabase.removeChannel(channel);
      }
    };
  }, [userId]);

  return { unreadCount, setUnreadCount };
}
