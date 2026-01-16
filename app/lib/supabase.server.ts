import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Standard Supabase client with Anon Key
 * - Respects Row Level Security (RLS) policies
 * - Use for: public SELECT queries, user-owned data operations
 * - Cannot bypass RLS or perform admin operations
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * Admin Supabase client with Service Role Key
 * - BYPASSES all Row Level Security (RLS) policies
 * - Use ONLY when necessary:
 *   1. INSERT on tables requiring service role (hotels)
 *   2. Complex JOIN queries that RLS might block
 *   3. Cross-user operations (messages, conversations)
 *   4. Bulk operations or admin tasks
 * - NEVER use for simple SELECT on public data
 */
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
