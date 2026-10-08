import { data, Form, Link, Outlet, useActionData, useLoaderData, useLocation, useNavigation, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { saveMailingDraft } from "~/lib/mailing-campaigns.server";

const privateHeaders = { "Cache-Control": "private, no-store" };
export const headers = () => privateHeaders;
export const meta = () => [{ title: "Last-minute emails | Runoot Admin" }];
export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const page = Math.max(1, Number.parseInt(new URL(request.url).searchParams.get("page") || "1", 10) || 1);
  const result = await supabaseAdmin.from("mailing_list_campaigns").select("id,subject,state,created_at", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * 25, page * 25 - 1);
  return data({ campaigns: result.data || [], count: result.count || 0, page, error: result.error ? "Could not load emails. Check that the mailing list database has been installed." : "" }, { headers: privateHeaders });
}
export async function action({ request }: ActionFunctionArgs) {
  const admin = await requireAdmin(request);
  if (request.method !== "POST" || request.headers.get("origin") !== new URL(request.url).origin) return data({ error: "Please reload this page and try again." }, { status: 403 });
  try {
    const form = await request.formData();
    if (form.get("intent") !== "new") return data({ error: "Unknown action." }, { status: 400 });
    const id = await saveMailingDraft(supabaseAdmin, { subject: "New Runoot Last Minute", preview_text: "", body: "Write your message here.", button_label: "", button_url: "" }, admin.id);
    return redirect(`/admin/mailing-list/campaigns/${id}`);
  } catch (cause) { return data({ error: cause instanceof Error ? cause.message : "Could not create email." }, { status: 503 }); }
}
export default function MailingCampaigns() {
  const { campaigns, count, page, error } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  const path = useLocation().pathname.replace(/\/$/, "");
  if (path !== "/admin/mailing-list/campaigns") return <Outlet />;
  return <section className="rounded-xl border border-gray-200 bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Emails</h2><Form method="post"><input type="hidden" name="intent" value="new" /><button disabled={busy || Boolean(error)} className="rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50">Create email</button></Form></div>
    <p className="mt-3 text-sm text-gray-600">Write a draft, review the preview, then send to all active subscribers.</p>
    {(error || result?.error) && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error || result?.error}</p>}
    <ul className="mt-4 divide-y divide-gray-100">{campaigns.map(item => <li key={item.id}><Link to={item.id} className="flex flex-wrap justify-between gap-2 py-4"><span className="break-words font-medium">{item.subject}</span><span className="text-sm capitalize text-gray-500">{item.state === 'submitted' ? 'Sent to delivery queue' : item.state}</span></Link></li>)}</ul>
    {!campaigns.length && !error && <p className="py-6 text-gray-500">No emails yet.</p>}
    <nav className="mt-4 flex gap-4 text-sm" aria-label="Email pages">{page > 1 && <Link to={`?page=${page - 1}`}>← Previous</Link>}{page * 25 < count && <Link to={`?page=${page + 1}`}>Next →</Link>}</nav>
  </section>;
}
