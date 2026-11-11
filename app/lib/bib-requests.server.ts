import { data, type ActionFunctionArgs } from "react-router";
import { supabaseAdmin } from "~/lib/supabase.server";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit.server";
import { BIB_CONSENT_TEXT, BIB_CONSENT_VERSION, bibRequestSource, validateBibRequest } from "~/lib/bib-requests";
import { sendTemplatedEmail } from "~/lib/email/service.server";
import { createMailingOffer } from "~/lib/mailing-list.server";
import { mailingIsConfigured } from "~/lib/mailing-provider.server";
import { escapeTelegramHtml, sendTelegram } from "~/lib/telegram.server";

export function landingLoader() { return { mode: "landing" as const }; }

export async function submitBibRequest({ request }: ActionFunctionArgs) {
  const headers = { "Cache-Control": "private, no-store" };
  const fail = (error: string, status = 400) => data({ success: false as const, error, race: "" }, { status, headers });
  if (request.method !== "POST") return fail("Method not allowed.", 405);
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return fail("Please reload this page and try again.", 403);
  // Many runners may share the same hotel Wi-Fi connection.
  const rate = checkRateLimit(`bib-request:${getClientIp(request)}`, 2000, 60 * 60 * 1000);
  if (!rate.allowed) return fail("Too many requests. Please try again later.", 429);
  if (Number(request.headers.get("content-length")) > 12000) return fail("Request too large.", 413);
  let form: FormData;
  try { form = await request.formData(); } catch { return fail("Please check the form and try again."); }
  if (String(form.get("website") ?? "")) return fail("Please reload this page and try again.");
  const parsed = validateBibRequest(form);
  if (parsed.error) return fail(parsed.error);
  if (!checkRateLimit(`bib-request-email:${parsed.value.email}`, 20, 60 * 60 * 1000).allowed) {
    return fail("Too many requests. Please try again later.", 429);
  }

  try {
    const { races, phone, ...contact } = parsed.value;
    const { error } = await supabaseAdmin.from("bib_requests").upsert(races.map(race => ({
      ...contact,
      // Leave a previously saved number untouched when a later request has none.
      ...(phone ? { phone } : {}),
      ...race,
      source: bibRequestSource(url.pathname),
      landing_path: url.pathname,
      consent_version: BIB_CONSENT_VERSION,
      consent_text: BIB_CONSENT_TEXT,
    })), { onConflict: "email,race_key" });
    if (error) {
      console.error("bib_request_save_failed", { code: error.code });
      return fail("We couldn’t save your request. Please try again in a moment.", 503);
    }
    // Start both notifications after saving; Telegram failures must not affect the request or email.
    const preferenceLabel = contact.preference === "both" ? "Pettorale o pacchetto completo" : contact.preference === "package" ? "Pacchetto completo" : "Solo pettorale";
    const telegramAlert = sendTelegram(
      `🎟️ <b>Richiesta BibExchange ricevuta</b>\n\n` +
      `<b>Gare:</b> ${races.map(item => escapeTelegramHtml(item.race)).join(", ")}\n` +
      `<b>Interesse:</b> ${preferenceLabel}\n` +
      `<b>Origine:</b> ${bibRequestSource(url.pathname) === "qr" ? "QR (/go)" : "Sito"}\n\n` +
      `<a href="https://www.runoot.com/admin/bib-requests">Apri le richieste Runoot</a>`
    );
    let confirmationEmail: "sent" | "failed" = "failed";
    try {
      const emailResult = await sendTemplatedEmail({
        to: contact.email,
        templateId: "bib_request_confirmation",
        locale: "en",
        payload: { firstName: contact.first_name, races: races.map(item => item.race), preference: contact.preference },
      });
      confirmationEmail = emailResult.ok ? "sent" : "failed";
    } catch {
      // Sending or logging an email failure must never undo a saved request.
      console.error("bib_request_confirmation_failed");
    }
    await telegramAlert;
    const mailingOffer = mailingIsConfigured() ? createMailingOffer(contact) : null;
    return data({ success: true as const, races: races.map(item => item.race), preference: contact.preference, confirmationEmail, mailingOffer, error: "" }, { headers });
  } catch {
    return fail("We couldn’t save your request. Please try again in a moment.", 503);
  }
}
