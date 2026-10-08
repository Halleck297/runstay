import { data, type ActionFunctionArgs } from "react-router";
import { supabaseAdmin } from "~/lib/supabase.server";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit.server";
import { getAppUrl } from "~/lib/app-url.server";
import { readMailingOffer, requestMailingConfirmation } from "~/lib/mailing-list.server";
import { mailingIsConfigured } from "~/lib/mailing-provider.server";

const headers = { "Cache-Control": "private, no-store" };
export async function action({ request }: ActionFunctionArgs) {
  const fail = (error: string, status = 400) => data({ success: false, error }, { status, headers });
  if (request.method !== "POST") return fail("Method not allowed.", 405);
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail("Please reload the page and try again.", 403);
  if (!mailingIsConfigured()) return fail("The mailing list is temporarily unavailable.", 503);
  if (Number(request.headers.get("content-length")) > 6000) return fail("Request too large.", 413);
  if (!checkRateLimit(`mailing-ip:${getClientIp(request)}`, 30, 60 * 60 * 1000).allowed) return fail("Please try again later.", 429);
  let form: FormData;
  try { form = await request.formData(); } catch { return fail("Invalid request."); }
  if (form.get("consent") !== "yes") return fail("Please choose to subscribe before continuing.");
  const contact = readMailingOffer(String(form.get("offer") || ""));
  if (!contact) return fail("This offer has expired. Submit your race request again to receive a new subscription link.");
  if (!checkRateLimit(`mailing-email:${contact.email}`, 5, 60 * 60 * 1000).allowed) return fail("A confirmation was recently requested. Please check your inbox or try again later.", 429);
  try {
    await requestMailingConfirmation(supabaseAdmin, contact, getAppUrl(request));
    return data({ success: true, error: "" }, { headers });
  } catch (error) { return fail(error instanceof Error ? error.message : "Please try again later.", 503); }
}

export function loader() { return data({ error: "Not found" }, { status: 404, headers }); }
