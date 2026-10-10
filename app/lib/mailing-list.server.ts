import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { MAILING_CONSENT_TEXT, MAILING_CONSENT_VERSION, type MailingContact } from "./mailing-list";
import { getMailingMember, subscribeMailingMember } from "./mailing-provider.server";

const table = "mailing_list_signups";
type Client = SupabaseClient<Database>;

export function createMailingOffer(contact: MailingContact, now = Date.now()) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify({ ...contact, expires: now + 30 * 60 * 1000, purpose: "mailing-offer" })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

export function readMailingOffer(value: string, now = Date.now()): MailingContact | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || value.length > 3000) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (parsed.purpose !== "mailing-offer" || !Number.isFinite(parsed.expires) || parsed.expires <= now) return null;
    if (![parsed.email, parsed.first_name, parsed.last_name].every(value => typeof value === "string")) return null;
    return { email: parsed.email, first_name: parsed.first_name, last_name: parsed.last_name };
  } catch { return null; }
}

export async function activateMailingFromPopup(client: Client, contact: MailingContact) {
  const existing = await getMailingMember(contact.email);
  if (existing?.unsubscribed) {
    throw new Error("This address previously unsubscribed. Contact support@runoot.com if you want to join again.");
  }
  const saved = await client.from(table).upsert({
    ...contact,
    source: "popup",
    consent_text: MAILING_CONSENT_TEXT,
    consent_version: MAILING_CONSENT_VERSION,
    requested_at: new Date().toISOString(),
    added_by: null,
    token_hash: null,
    token_expires_at: null,
  }, { onConflict: "email" }).select("id").single();
  if (saved.error) throw new Error("We couldn’t save your subscription. Please try again.");
  const member = await subscribeMailingMember(contact);
  const confirmed = await client.from(table).update({ confirmed_at: new Date().toISOString(), resend_contact_id: member.id }).eq("id", saved.data.id);
  if (confirmed.error) console.error("mailing_consent_confirmation_audit_failed", { id: saved.data.id });
}

export async function addMailingMemberManually(client: Client, contact: MailingContact, adminId: string) {
  const existing = await getMailingMember(contact.email);
  if (existing?.unsubscribed) throw new Error("This address previously unsubscribed. Contact support@runoot.com if you want to join again.");
  // Record the administrator's consent declaration before activating the address.
  const saved = await client.from(table).upsert({ ...contact, source: "admin", consent_text: `Administrator confirms prior permission for: ${MAILING_CONSENT_TEXT}`, consent_version: MAILING_CONSENT_VERSION, added_by: adminId, requested_at: new Date().toISOString(), token_hash: null, token_expires_at: null }, { onConflict: "email" }).select("id").single();
  if (saved.error) throw new Error("Could not save the consent record. The address has not been added.");
  const member = await subscribeMailingMember(contact);
  const confirmed = await client.from(table).update({ confirmed_at: new Date().toISOString(), resend_contact_id: member.id }).eq("id", saved.data.id);
  if (confirmed.error) throw new Error("The address was added, but its confirmation record could not be updated. Refresh the list before retrying.");
}
