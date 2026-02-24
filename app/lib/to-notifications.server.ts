import { sendTemplatedEmail } from "~/lib/email/service.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export type ToNotificationPrefKey =
  | "info_request"
  | "new_message"
  | "listing_status"
  | "listing_expiring"
  | "listing_pending"
  | "admin_action"
  | "credentials_change";

export type ToNotificationPrefs = Record<ToNotificationPrefKey, boolean>;

const PREFS_KIND = "to_notification_prefs";

export const DEFAULT_TO_NOTIFICATION_PREFS: ToNotificationPrefs = {
  info_request: true,
  new_message: true,
  listing_status: true,
  listing_expiring: true,
  listing_pending: true,
  admin_action: true,
  credentials_change: true,
};

function normalizePrefs(raw: any): ToNotificationPrefs {
  return {
    info_request: raw?.info_request !== false,
    new_message: raw?.new_message !== false,
    listing_status: raw?.listing_status !== false,
    listing_expiring: raw?.listing_expiring !== false,
    listing_pending: raw?.listing_pending !== false,
    admin_action: raw?.admin_action !== false,
    credentials_change: raw?.credentials_change !== false,
  };
}

export async function getToNotificationPrefs(userId: string): Promise<ToNotificationPrefs> {
  const { data } = await (supabaseAdmin.from("notifications") as any)
    .select("data, created_at")
    .eq("user_id", userId)
    .eq("type", "system")
    .filter("data->>kind", "eq", PREFS_KIND)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rawPrefs = (data as any)?.data?.prefs;
  if (!rawPrefs) return DEFAULT_TO_NOTIFICATION_PREFS;
  return normalizePrefs(rawPrefs);
}

export async function saveToNotificationPrefs(userId: string, prefs: ToNotificationPrefs) {
  const normalized = normalizePrefs(prefs);

  await (supabaseAdmin.from("notifications") as any)
    .delete()
    .eq("user_id", userId)
    .eq("type", "system")
    .filter("data->>kind", "eq", PREFS_KIND);

  await (supabaseAdmin.from("notifications") as any).insert({
    user_id: userId,
    type: "system",
    title: "TO notification preferences",
    message: "Tour Operator notification preferences",
    data: { kind: PREFS_KIND, prefs: normalized },
    read_at: new Date().toISOString(),
  });
}

export async function sendToUnifiedNotificationEmail(args: {
  userId: string;
  prefKey: ToNotificationPrefKey;
  message: string;
  ctaUrl?: string;
}) {
  const { data: profile } = await (supabaseAdmin as any)
    .from("profiles")
    .select("id, email, user_type, preferred_language")
    .eq("id", args.userId)
    .maybeSingle();

  if (!profile || profile.user_type !== "tour_operator" || !profile.email) return;

  const prefs = await getToNotificationPrefs(profile.id);
  if (!prefs[args.prefKey]) return;

  await sendTemplatedEmail({
    to: profile.email,
    templateId: "platform_notification",
    locale: profile.preferred_language || "en",
    payload: {
      title: "Runoot update for your TO account",
      message: args.message,
      ctaLabel: args.ctaUrl ? "Open Runoot" : undefined,
      ctaUrl: args.ctaUrl,
    },
  });
}
