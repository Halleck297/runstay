import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { supabaseAdmin } from "~/lib/supabase.server";

export async function loader(_: LoaderFunctionArgs) {
  const { count } = await (supabaseAdmin as any)
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .eq("listing_mode", "event");

  return data({ count: count || 0 });
}
