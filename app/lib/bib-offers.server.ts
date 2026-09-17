import { data, type ActionFunctionArgs } from "react-router";
import { supabaseAdmin } from "~/lib/supabase.server";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit.server";
import { BIB_OFFER_CONSENT, BIB_OFFER_VERSION, validateBibOffer } from "./bib-offers";

export async function submitBibOffer({ request }: ActionFunctionArgs) {
  const headers = { "Cache-Control": "private, no-store" };
  const fail = (error: string, status = 400) => data({ success: false as const, error }, { status, headers });
  if (request.method !== "POST") return fail("Method not allowed.", 405);
  const url = new URL(request.url), origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return fail("Please reload this page and try again.", 403);
  if (!checkRateLimit(`bib-offer:${getClientIp(request)}`, 200, 60 * 60 * 1000).allowed) return fail("Too many requests. Please try again later.", 429);
  if (Number(request.headers.get("content-length")) > 16000) return fail("Request too large.", 413);
  let form: FormData;
  try { form = await request.formData(); } catch { return fail("Please check the form and try again."); }
  if (String(form.get("website") ?? "")) return fail("Please reload this page and try again.");
  const parsed = validateBibOffer(form);
  if (parsed.error) return fail(parsed.error);
  if (!checkRateLimit(`bib-offer-email:${parsed.value.email}`, 10, 60 * 60 * 1000).allowed) return fail("Too many requests. Please try again later.", 429);
  try {
    const { error } = await supabaseAdmin.from("bib_offers").insert({ ...parsed.value, consent_text: BIB_OFFER_CONSENT, consent_version: BIB_OFFER_VERSION });
    if (error) { console.error("bib_offer_save_failed", { code: error.code }); return fail("We couldn’t save your offer. Please try again in a moment.", 503); }
    return data({ success: true as const, error: "" }, { headers });
  } catch { return fail("We couldn’t save your offer. Please try again in a moment.", 503); }
}
