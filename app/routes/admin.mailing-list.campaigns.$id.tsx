import { useState } from "react";
import { data, Form, Link, redirect, useActionData, useLoaderData, useNavigation, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { parseCampaign, type CampaignContent } from "~/lib/mailing-list";
import { refreshMailingCampaign, saveMailingDraft, sendMailingCampaign, type MailingCampaign } from "~/lib/mailing-campaigns.server";
import { getMailingBroadcast, mailingIsConfigured } from "~/lib/mailing-provider.server";
import { renderMailingCampaign } from "~/lib/email/templates/mailingList";

const privateHeaders = { "Cache-Control": "private, no-store" };
export const headers = () => privateHeaders;
export const meta = () => [{ title: "Compose email | Runoot Admin" }];
async function loadCampaign(id?: string) {
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) throw new Response("Email not found", { status: 404 });
  const result = await supabaseAdmin.from("mailing_list_campaigns").select("*").eq("id", id).maybeSingle();
  if (result.error) throw new Response("Could not load email", { status: 503 });
  if (!result.data) throw new Response("Email not found", { status: 404 });
  return result.data;
}
export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const campaign = await loadCampaign(params.id);
  let deliveryStatus: string | null = null, providerError = "";
  if (campaign.resend_broadcast_id) {
    try { deliveryStatus = (await getMailingBroadcast(campaign.resend_broadcast_id)).status; }
    catch (cause) { providerError = cause instanceof Error ? cause.message : "Could not check delivery."; }
  }
  return data({ campaign, deliveryStatus, providerError, configured: mailingIsConfigured() }, { headers: privateHeaders });
}
export async function action({ request, params }: ActionFunctionArgs) {
  const admin = await requireAdmin(request);
  const fail = (error: string) => data({ error, message: "" }, { status: 400, headers: privateHeaders });
  if (request.method !== "POST" || request.headers.get("origin") !== new URL(request.url).origin) return fail("Please reload this page and try again.");
  const campaign = await loadCampaign(params.id);
  try {
    const form = await request.formData();
    const intent = form.get("intent");
    if (intent === "save") {
      await saveMailingDraft(supabaseAdmin, parseCampaign(form), admin.id, { id: campaign.id, version: String(form.get("version") || "") });
      return data({ error: "", message: "Draft saved." }, { headers: privateHeaders });
    }
    if (intent === "duplicate") {
      const id = await saveMailingDraft(supabaseAdmin, campaign, admin.id);
      return redirect(`/admin/mailing-list/campaigns/${id}`);
    }
    if (intent === "refresh") {
      const status = await refreshMailingCampaign(supabaseAdmin, campaign);
      return data({ error: "", message: status ? `Delivery status: ${status}.` : "Status refreshed." }, { headers: privateHeaders });
    }
    if (intent !== "send" || form.get("confirm") !== "yes") return fail("Confirm that you want to send this email to all active subscribers.");
    await sendMailingCampaign(supabaseAdmin, campaign.id, String(form.get("version") || ""));
    return data({ error: "", message: "Email submitted for delivery. You can close this page; sending will continue." }, { headers: privateHeaders });
  } catch (cause) { return fail(cause instanceof Error ? cause.message : "Could not update this email."); }
}

function Composer({ campaign, busy, configured }: { campaign: MailingCampaign; busy: boolean; configured: boolean }) {
  const [content, setContent] = useState<CampaignContent>({ subject: campaign.subject, preview_text: campaign.preview_text, body: campaign.body, button_label: campaign.button_label, button_url: campaign.button_url });
  const draft = campaign.state === "draft";
  const dirty = Object.entries(content).some(([key, value]) => value !== campaign[key as keyof CampaignContent]);
  const input = "mt-1 block w-full rounded-lg border border-gray-300 p-2.5 disabled:bg-gray-50";
  const field = (key: keyof CampaignContent) => ({ name: key, value: content[key], disabled: !draft || busy, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setContent({ ...content, [key]: event.target.value }) });
  return <div className="grid gap-6 xl:grid-cols-2">
    <div className="space-y-5">
      <Form method="post" className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
        <input type="hidden" name="intent" value="save" /><input type="hidden" name="version" value={campaign.updated_at} />
        <h2 className="text-lg font-semibold">Your email</h2>
        <label className="block text-sm font-medium">Subject<input {...field('subject')} required maxLength={150} className={input} /></label>
        <label className="block text-sm font-medium">Inbox preview (optional)<input {...field('preview_text')} maxLength={200} className={input} /></label>
        <label className="block text-sm font-medium">Message<textarea {...field('body')} required maxLength={20000} rows={12} className={input} /></label>
        <p className="text-xs text-gray-500">Use plain text and blank lines for paragraphs. Add a button below to link to an offer.</p>
        <label className="block text-sm font-medium">Button text (optional)<input {...field('button_label')} maxLength={80} className={input} placeholder="View the offers" /></label>
        <label className="block text-sm font-medium">Button link<input {...field('button_url')} type="url" maxLength={2000} className={input} placeholder="https://…" /></label>
        {draft && <button disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save draft'}</button>}
      </Form>
      {["draft", "ready"].includes(campaign.state) && <Form method="post" className="space-y-4 rounded-xl border border-brand-200 bg-brand-50 p-5">
        <input type="hidden" name="intent" value="send" /><input type="hidden" name="version" value={campaign.updated_at} />
        <h2 className="text-lg font-semibold">Send to the mailing list</h2>
        <p className="text-sm text-gray-700">All currently active subscribers will receive this email. Unsubscribed addresses are excluded automatically.</p>
        {dirty && <p role="status" className="text-sm font-semibold">Save your changes before sending.</p>}
        {!configured && <p role="alert" className="text-sm">Complete the mailing service configuration before sending.</p>}
        <label className="flex items-start gap-2 text-sm"><input name="confirm" value="yes" type="checkbox" required className="mt-1" disabled={busy || dirty || !configured} />I have reviewed the saved email and want to send it to all active subscribers.</label>
        <button disabled={busy || dirty || !configured} className="rounded-lg bg-navy-900 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{busy ? 'Please wait…' : 'Send email now'}</button>
      </Form>}
    </div>
    <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4"><h2 className="mb-3 text-lg font-semibold">Live preview</h2><iframe title="Email preview" sandbox="" referrerPolicy="no-referrer" srcDoc={renderMailingCampaign(content, true).html} className="h-[760px] w-full rounded-lg border border-gray-100" /><p className="mt-2 text-xs text-gray-500">The unsubscribe link will be personalized for each recipient.</p></section>
  </div>;
}
export default function MailingCampaignDetail() {
  const { campaign, deliveryStatus, providerError, configured } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link to="/admin/mailing-list/campaigns" className="text-sm">← All emails</Link><span className="rounded-full bg-gray-100 px-3 py-1 text-sm capitalize">{deliveryStatus || campaign.state}</span></div>
    {!busy && result && <p role={result.error ? 'alert' : 'status'} className={`rounded-lg p-4 text-sm ${result.error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>{result.error || result.message}</p>}
    {(providerError || campaign.last_error) && <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">{providerError || campaign.last_error}</p>}
    {campaign.state !== "draft" && <div className="rounded-xl border border-gray-200 bg-white p-5"><p className="text-sm text-gray-700">This email is locked for sending. Refresh to check delivery, or copy it to start a different email.</p>{campaign.state === 'sending' && <p className="mt-2 text-sm text-gray-700">If the status remains draft, inspect this existing email in Resend before sending it there. Do not create a second copy to retry.</p>}<Form method="post" className="mt-3 flex flex-wrap gap-3"><button name="intent" value="refresh" disabled={busy} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Refresh status</button>{campaign.state === 'submitted' && <button name="intent" value="duplicate" disabled={busy} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Copy to new draft</button>}{campaign.resend_broadcast_id && <a href="https://resend.com/broadcasts" target="_blank" rel="noreferrer" className="px-4 py-2 text-sm underline">Open Resend</a>}</Form>{campaign.resend_broadcast_id && <p className="mt-3 break-all text-xs text-gray-500">Email reference: {campaign.resend_broadcast_id}</p>}</div>}
    <Composer key={`${campaign.id}:${campaign.updated_at}`} campaign={campaign} busy={busy} configured={configured} />
  </div>;
}
