import type { MailingContact, CampaignContent } from "./mailing-list";
import { renderMailingCampaign } from "./email/templates/mailingList";

export type MailingMember = MailingContact & { id: string; unsubscribed: boolean; created_at: string };
export type Broadcast = { id: string; segment_id: string; status: string; subject: string; sent_at: string | null };
export class MailingProviderError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function mailingIsConfigured() {
  return Boolean(process.env.RESEND_LAST_MINUTE_SEGMENT_ID?.trim() && (process.env.RESEND_MARKETING_API_KEY?.trim() || process.env.RESEND_API_KEY?.trim()));
}

function config() {
  const key = process.env.RESEND_MARKETING_API_KEY?.trim() || process.env.RESEND_API_KEY?.trim();
  const segment = process.env.RESEND_LAST_MINUTE_SEGMENT_ID?.trim();
  if (!key || !segment) throw new Error("The mailing list is not configured. Set the marketing API key and last-minute segment in the server configuration.");
  if (!/^[A-Za-z0-9_-]+$/.test(key)) throw new Error("The marketing API key contains unexpected characters. Check the value saved in the server configuration.");
  return { key, segment };
}

export async function mailingApi<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const { key } = config();
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let response: Response;
    try {
      response = await fetch(`https://api.resend.com${path}`, { method, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
    } catch (error) {
      // Never log the request, headers or raw error: malformed credentials may
      // be included in fetch error messages. Only retain safe diagnostic codes.
      const causeCode = (error as { cause?: { code?: unknown } })?.cause?.code;
      const code = typeof causeCode === "string" && ["ENOTFOUND", "ECONNRESET", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"].includes(causeCode) ? causeCode : "FETCH_FAILED";
      console.error("[mailing:resend]", controller.signal.aborted ? "TIMEOUT" : code);
      throw new MailingProviderError(0, "The mailing service did not respond. Refresh to check the current state before retrying.");
    } finally { clearTimeout(timeout); }
    if (response.status === 429 && attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, Math.min(5000, Math.max(1000, Number(response.headers.get("retry-after")) * 1000 || 1000))));
      continue;
    }
    if (!response.ok) {
      throw new MailingProviderError(response.status, response.status === 401 || response.status === 403
        ? "The Resend key cannot manage contacts and campaigns. Configure a full-access marketing key."
        : response.status === 429 ? "The mailing service is busy. Please retry shortly."
          : `The mailing service could not complete this operation (HTTP ${response.status}).`);
    }
    return await response.json() as T;
  }
  throw new Error("The mailing service is busy. Please retry shortly.");
}

export async function getMailingMember(emailOrId: string) {
  try { return await mailingApi<MailingMember>(`/contacts/${encodeURIComponent(emailOrId)}`); }
  catch (error) { if (error instanceof MailingProviderError && error.status === 404) return null; throw error; }
}

export async function subscribeMailingMember(contact: MailingContact, verifiedByRecipient: boolean) {
  const { segment } = config();
  const existing = await getMailingMember(contact.email);
  if (existing?.unsubscribed && !verifiedByRecipient) {
    throw new Error("This address previously unsubscribed. Ask the person to subscribe again through the website and confirm their email.");
  }
  if (!existing) {
    // Confirmation callers also hold the local consent/token record. Send only
    // the contact fields the provider needs, never database or token metadata.
    return await mailingApi<{ id: string }>("/contacts", "POST", { email: contact.email, first_name: contact.first_name, last_name: contact.last_name, unsubscribed: false, segments: [{ id: segment }] });
  }
  await mailingApi(`/contacts/${encodeURIComponent(existing.id)}/segments/${encodeURIComponent(segment)}`, "POST");
  if (existing.unsubscribed) await mailingApi(`/contacts/${encodeURIComponent(existing.id)}`, "PATCH", { unsubscribed: false });
  return { id: existing.id };
}

export function listMailingMembers(after?: string) {
  const query = new URLSearchParams({ limit: "100" });
  if (after) query.set("after", after);
  return mailingApi<{ data: MailingMember[]; has_more: boolean }>(`/segments/${encodeURIComponent(config().segment)}/contacts?${query}`);
}

export async function unsubscribeMailingMember(id: string) {
  // Verify membership before allowing an admin to alter a contact.
  let after: string | undefined;
  do {
    const page = await listMailingMembers(after);
    if (page.data.some(contact => contact.id === id)) return mailingApi(`/contacts/${encodeURIComponent(id)}`, "PATCH", { unsubscribed: true });
    const next = page.has_more ? page.data.at(-1)?.id : undefined;
    if (!next || next === after) break;
    after = next;
  } while (after);
  throw new Error("This contact is not in the last-minute mailing list.");
}

export async function createMailingBroadcast(content: CampaignContent) {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("The sender email is not configured.");
  const rendered = renderMailingCampaign(content);
  return mailingApi<{ id: string }>("/broadcasts", "POST", { segment_id: config().segment, from, subject: content.subject, preview_text: content.preview_text, html: rendered.html, text: rendered.text, name: content.subject, send: false });
}

export async function getMailingBroadcast(id: string) {
  const broadcast = await mailingApi<Broadcast>(`/broadcasts/${encodeURIComponent(id)}`);
  if (broadcast.segment_id !== config().segment) throw new Error("This campaign does not belong to the last-minute mailing list.");
  return broadcast;
}

export async function sendMailingBroadcast(id: string) {
  const broadcast = await getMailingBroadcast(id);
  if (["queued", "scheduled", "sending", "sent"].includes(broadcast.status)) return broadcast.status;
  if (broadcast.status !== "draft") throw new Error(`This email cannot be sent while its status is ${broadcast.status}.`);
  await mailingApi(`/broadcasts/${encodeURIComponent(id)}/send`, "POST", {});
  return "queued";
}
