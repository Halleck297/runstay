import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { MAILING_CONSENT_TEXT, MAILING_CONSENT_VERSION, type MailingContact } from "./mailing-list";
import { getMailingMember, subscribeMailingMember } from "./mailing-provider.server";
import { sendTemplatedEmail } from "./email/service.server";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
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

export async function requestMailingConfirmation(client: Client, contact: MailingContact, appUrl: string) {
  const now = new Date();
  const rawToken = randomBytes(32).toString("base64url");
  const values = { ...contact, source: "popup" as const, consent_text: MAILING_CONSENT_TEXT, consent_version: MAILING_CONSENT_VERSION, requested_at: now.toISOString(), token_hash: hash(rawToken), token_expires_at: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString() };
  // Ignore repeated clicks, then atomically allow a new link after ten minutes.
  const inserted = await client.from(table).upsert(values, { onConflict: "email", ignoreDuplicates: true }).select("id").maybeSingle();
  if (inserted.error) throw new Error("We couldn’t save your subscription request. Please try again.");
  let signup = inserted.data;
  if (!signup) {
    const updated = await client.from(table).update(values).eq("email", contact.email)
      .lt("requested_at", new Date(now.getTime() - 10 * 60 * 1000).toISOString()).select("id").maybeSingle();
    if (updated.error) throw new Error("We couldn’t save your subscription request. Please try again.");
    signup = updated.data;
  }
  if (!signup) return;
  const result = await sendTemplatedEmail({ to: contact.email, templateId: "mailing_list_confirmation", locale: "en", payload: { confirmUrl: `${appUrl}/mailing-list/confirm?token=${rawToken}` } });
  if (!result.ok) {
    // Permit a retry after a failed send, without affecting a newer request.
    await client.from(table).update({ requested_at: new Date(0).toISOString() }).eq("id", signup.id).eq("token_hash", values.token_hash);
    throw new Error("We couldn’t send the confirmation email. Please try again.");
  }
}

export async function confirmationIsValid(client: Client, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const result = await client.from(table).select("id").eq("token_hash", hash(token)).gt("token_expires_at", new Date().toISOString()).maybeSingle();
  if (result.error) throw new Error("We couldn’t check this link. Please try again shortly.");
  return Boolean(result.data);
}

export async function confirmMailingSubscription(client: Client, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("This confirmation link is invalid or has expired.");
  // Consume first: scanners only GET, and an old link can never undo a later opt-out.
  const claimed = await client.from(table).update({ token_hash: null, token_expires_at: null })
    .eq("token_hash", hash(token)).gt("token_expires_at", new Date().toISOString()).select("*").maybeSingle();
  if (claimed.error) throw new Error("We couldn’t confirm your subscription. Please try again.");
  if (!claimed.data) throw new Error("This link has expired or has already been used. Request a new confirmation email from the website.");
  try {
    const member = await subscribeMailingMember(claimed.data, true);
    const saved = await client.from(table).update({ confirmed_at: new Date().toISOString(), resend_contact_id: member.id }).eq("id", claimed.data.id);
    if (saved.error) console.error("mailing_consent_confirmation_audit_failed", { id: claimed.data.id });
  } catch {
    await client.from(table).update({ requested_at: new Date(0).toISOString() }).eq("id", claimed.data.id).is("token_hash", null);
    throw new Error("We couldn’t activate your subscription. Please return to the website and request a new confirmation email.");
  }
}

export async function addMailingMemberManually(client: Client, contact: MailingContact, adminId: string) {
  const existing = await getMailingMember(contact.email);
  if (existing?.unsubscribed) throw new Error("This address previously unsubscribed. Ask the person to subscribe again through the website and confirm their email.");
  // Record the administrator's consent declaration before activating the address.
  const saved = await client.from(table).upsert({ ...contact, source: "admin", consent_text: `Administrator confirms prior permission for: ${MAILING_CONSENT_TEXT}`, consent_version: MAILING_CONSENT_VERSION, added_by: adminId, requested_at: new Date().toISOString(), token_hash: null, token_expires_at: null }, { onConflict: "email" }).select("id").single();
  if (saved.error) throw new Error("Could not save the consent record. The address has not been added.");
  const member = await subscribeMailingMember(contact, false);
  const confirmed = await client.from(table).update({ confirmed_at: new Date().toISOString(), resend_contact_id: member.id }).eq("id", saved.data.id);
  if (confirmed.error) throw new Error("The address was added, but its confirmation record could not be updated. Refresh the list before retrying.");
}
