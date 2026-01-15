import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client standard con Anon Key (per auth e operazioni normali con RLS)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Client con Service Role Key (SOLO per operazioni admin che bypassano RLS)
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Client per operazioni con token utente specifico
export function getSupabaseClient(accessToken?: string) {
  if (!accessToken) return supabase;

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
