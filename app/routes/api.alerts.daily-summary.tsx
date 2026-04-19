import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { supabaseAdmin } from "~/lib/supabase.server";
import { sendTelegram } from "~/lib/telegram.server";

// Called by Vercel Cron at 18:00 UTC (20:00 CEST / 19:00 CET)
export async function loader({ request }: LoaderFunctionArgs) {
  // Vercel injects CRON_SECRET automatically for cron requests
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();

  const [
    { count: newUsers },
    { count: newMessages },
    { count: newListings },
    { count: pendingListings },
    { count: activeListings },
    { count: newConversations },
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", todayStartIso),
    supabaseAdmin.from("messages").select("id", { count: "exact", head: true }).gte("created_at", todayStartIso),
    supabaseAdmin.from("listings").select("id", { count: "exact", head: true }).gte("created_at", todayStartIso),
    supabaseAdmin.from("listings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabaseAdmin.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabaseAdmin.from("conversations").select("id", { count: "exact", head: true }).gte("created_at", todayStartIso),
  ]);

  const dateLabel = now.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Rome" });

  await sendTelegram(
    `📊 <b>Runoot Daily Summary — ${dateLabel}</b>\n\n` +
    `👤 New users: <b>${newUsers ?? 0}</b>\n` +
    `💬 Messages sent: <b>${newMessages ?? 0}</b>\n` +
    `🔗 New conversations: <b>${newConversations ?? 0}</b>\n` +
    `📋 New listings: <b>${newListings ?? 0}</b>\n\n` +
    `⏳ Listings pending approval: <b>${pendingListings ?? 0}</b>\n` +
    `✅ Active listings (total): <b>${activeListings ?? 0}</b>`
  );

  return data({ ok: true, date: dateLabel });
}
