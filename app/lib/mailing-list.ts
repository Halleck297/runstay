export const MAILING_CONSENT_VERSION = "2026-10-09";
export const MAILING_CONSENT_TEXT = "I want email updates about bibs, hotel offers, race packages and last-minute opportunities across all races and destinations. I can unsubscribe at any time.";

export type MailingContact = { email: string; first_name: string; last_name: string };
export type CampaignContent = { subject: string; preview_text: string; body: string; button_label: string; button_url: string };

export function parseMailingContact(form: FormData): MailingContact {
  const email = String(form.get("email") || "").normalize("NFKC").trim().toLowerCase();
  const first_name = String(form.get("firstName") || "").trim();
  const last_name = String(form.get("lastName") || "").trim();
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new Error("Enter a valid email address.");
  if ([first_name, last_name].some(value => value.length > 100 || /[\u0000-\u001f]/.test(value))) throw new Error("Names must contain at most 100 characters.");
  return { email, first_name, last_name };
}

export function parseCampaign(form: FormData): CampaignContent {
  const field = (key: string) => String(form.get(key) || "").trim();
  const content = { subject: field("subject"), preview_text: field("preview_text"), body: field("body"), button_label: field("button_label"), button_url: field("button_url") };
  if (!content.subject || content.subject.length > 150 || /[\r\n]/.test(content.subject)) throw new Error("Enter a subject of 1–150 characters.");
  if (content.preview_text.length > 200) throw new Error("Preview text can contain at most 200 characters.");
  if (!content.body || content.body.length > 20000) throw new Error("Enter a message of 1–20,000 characters.");
  if (content.button_label.length > 80 || Boolean(content.button_label) !== Boolean(content.button_url)) throw new Error("Fill in both the button label and its link, or leave both empty.");
  if (content.button_url) {
    let url: URL;
    try { url = new URL(content.button_url); } catch { throw new Error("Enter a complete https:// link for the button."); }
    if (url.protocol !== "https:" || url.username || url.password || content.button_url.length > 2000) throw new Error("Use an https:// link without embedded credentials.");
  }
  // Campaign interpolation is reserved for the unsubscribe link we supply.
  if (Object.values(content).some(value => value.includes("{{{") || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))) throw new Error("Remove unsupported control characters or template placeholders.");
  return content;
}
