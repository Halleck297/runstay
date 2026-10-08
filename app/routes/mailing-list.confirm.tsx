import { data, Form, Link, useActionData, useLoaderData, useNavigation, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import BibInfoLayout from "~/components/BibInfoLayout";
import { supabaseAdmin } from "~/lib/supabase.server";
import { confirmationIsValid, confirmMailingSubscription } from "~/lib/mailing-list.server";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit.server";
export { links } from "~/components/BibInfoLayout";

const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
export const headers = () => privateHeaders;
export const meta = () => [{ title: "Confirm your subscription | Runoot Last Minute" }, { name: "robots", content: "noindex,nofollow" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const token = new URL(request.url).searchParams.get("token") || "";
  try { return data({ token, valid: await confirmationIsValid(supabaseAdmin, token), error: "" }, { headers: privateHeaders }); }
  catch { return data({ token, valid: false, error: "We couldn’t check this link. Please try again shortly." }, { status: 503, headers: privateHeaders }); }
}

export async function action({ request }: ActionFunctionArgs) {
  const fail = (error: string, status = 400) => data({ success: false, error }, { status, headers: privateHeaders });
  if (request.method !== "POST") return fail("Method not allowed.", 405);
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail("Please reload this page and try again.", 403);
  if (!checkRateLimit(`mailing-confirm:${getClientIp(request)}`, 30, 60 * 60 * 1000).allowed) return fail("Please try again later.", 429);
  const form = await request.formData();
  if (form.get("intent") !== "confirm") return fail("Please confirm your subscription.");
  try {
    await confirmMailingSubscription(supabaseAdmin, String(form.get("token") || ""));
    return data({ success: true, error: "" }, { headers: privateHeaders });
  } catch (error) { return fail(error instanceof Error ? error.message : "Please request a new confirmation link."); }
}

export default function MailingConfirmation() {
  const { token, valid, error } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  return <BibInfoLayout eyebrow="RUNOOT LAST MINUTE" title={result?.success ? "You’re on the list." : "Confirm your subscription."} intro="Bibs, hotel offers, race packages and last-minute opportunities across all races and destinations.">
    <div className="bib-info-card" style={{ maxWidth: 640 }}>
      {result?.success ? <><p role="status">Your subscription is active. You can unsubscribe using the link in any Runoot Last Minute email.</p><Link to="/" className="bib-submit">Back to BibExchange</Link></>
        : <>{(result?.error || error) && <p role="alert" className="bib-error">{result?.error || error}</p>}{valid && !result?.error ? <Form method="post"><input type="hidden" name="token" value={token} /><input type="hidden" name="intent" value="confirm" /><p>Confirm that you want to receive Runoot Last Minute by email. This is optional and separate from updates about your race requests.</p><button className="bib-submit" disabled={busy}>{busy ? "Confirming…" : "Confirm my subscription"}</button></Form> : <p>This link may have expired or already been used. <Link to="/">Return to the website</Link> to request a new confirmation email.</p>}</>}
    </div>
  </BibInfoLayout>;
}
