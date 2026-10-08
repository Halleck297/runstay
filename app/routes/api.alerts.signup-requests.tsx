import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { supabaseAdmin } from "~/lib/supabase.server";
import { sendTelegram } from "~/lib/telegram.server";

// Vercel Cron runs at 18:00 UTC (20:00 CEST / 19:00 CET).
export async function loader({ request }: LoaderFunctionArgs) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  // Use consecutive 18:00 UTC boundaries so requests submitted after one
  // evening's check are included in the next one.
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setUTCHours(18, 0, 0, 0);
  if (now < windowEnd) windowEnd.setUTCDate(windowEnd.getUTCDate() - 1);
  const windowStart = new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000);

  const { count, error } = await (supabaseAdmin.from("access_requests" as any) as any)
    .select("id", { count: "exact", head: true })
    .eq("source", "public_signup")
    .eq("status", "pending")
    .gte("created_at", windowStart.toISOString())
    .lt("created_at", windowEnd.toISOString());

  if (error) {
    console.error("signup requests alert query failed", error);
    return data({ error: "Could not check signup requests" }, { status: 500 });
  }

  if (!count) return data({ ok: true, sent: false, count: 0 });

  const requestLabel = count === 1 ? "nuova richiesta" : "nuove richieste";
  const sent = await sendTelegram(
    `🔔 <b>${count} ${requestLabel} di iscrizione</b> da approvare.\n\n` +
    `<a href="https://www.runoot.com/admin/access-requests">Apri le richieste</a>`
  );
  if (!sent) return data({ error: "Could not send signup request alert" }, { status: 502 });

  return data({ ok: true, sent: true, count });
}
