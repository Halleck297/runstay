import { data, type ActionFunctionArgs } from "react-router";
import { supabaseAdmin } from "~/lib/supabase.server";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit.server";
import { BIB_CONSENT_TEXT, BIB_CONSENT_VERSION, bibRequestSource, validateBibRequest } from "~/lib/bib-requests";
import { sendTemplatedEmail } from "~/lib/email/service.server";

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
    const { races, ...contact } = parsed.value;
    const { data: savedRequests, error } = await supabaseAdmin.from("bib_requests").upsert(races.map(race => ({
      ...contact,
      ...race,
      source: bibRequestSource(url.pathname),
      landing_path: url.pathname,
      consent_version: BIB_CONSENT_VERSION,
      consent_text: BIB_CONSENT_TEXT,
    })), { onConflict: "email,race_key", ignoreDuplicates: true }).select("race,race_key");
    if (error) {
      console.error("bib_request_save_failed", { code: error.code });
      return fail("We couldn’t save your request. Please try again in a moment.", 503);
    }
    let confirmationEmail: "sent" | "failed" | "not_needed" = "not_needed";
    // Only newly saved races trigger an email. Repeated submissions retain the
    // original preferences and must not send duplicate or inaccurate summaries.
    if (savedRequests?.length) {
      confirmationEmail = "failed";
      try {
        const savedKeys = new Set(savedRequests.map(item => item.race_key));
        const emailResult = await sendTemplatedEmail({
          to: contact.email,
          templateId: "bib_request_confirmation",
          locale: "en",
          payload: {
            firstName: contact.first_name,
            races: races.filter(item => savedKeys.has(item.race_key)).map(item => item.race),
            preference: contact.preference,
          },
        });
        confirmationEmail = emailResult.ok ? "sent" : "failed";
      } catch {
        // Sending or logging an email failure must never undo a saved request.
        console.error("bib_request_confirmation_failed");
      }
    }
    return data({ success: true as const, races: races.map(item => item.race), preference: contact.preference, confirmationEmail, error: "" }, { headers });
  } catch {
    return fail("We couldn’t save your request. Please try again in a moment.", 503);
  }
}
