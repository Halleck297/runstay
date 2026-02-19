import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Singleton pattern per evitare multiple istanze del client
let supabaseClient: ReturnType<typeof createClient<Database>> | null = null;
let currentAccessToken: string | null = null;

export function hasBrowserAccessToken() {
  if (typeof window === "undefined") return false;
  return Boolean(window.ENV?.ACCESS_TOKEN);
}

export function getSupabaseBrowserClient() {
  const supabaseUrl = window.ENV?.SUPABASE_URL;
  const supabaseAnonKey = window.ENV?.SUPABASE_ANON_KEY;
  const accessToken = window.ENV?.ACCESS_TOKEN;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL and Anon Key must be provided via window.ENV");
  }

  // Recreate client if access token changed
  if (supabaseClient && currentAccessToken === accessToken) {
    return supabaseClient;
  }

  currentAccessToken = accessToken || null;

  supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    global: accessToken ? {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    } : undefined,
  });

  // Set the session for realtime to work with RLS
  if (accessToken) {
    supabaseClient.realtime.setAuth(accessToken);
  }

  return supabaseClient;
}

// Dichiarazione TypeScript per window.ENV
declare global {
  interface Window {
    ENV?: {
      SUPABASE_URL: string;
      SUPABASE_ANON_KEY: string;
      ACCESS_TOKEN?: string | null;
    };
  }
}
