import { data, Form, Link, useActionData, useLoaderData, useNavigation, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { parseMailingContact } from "~/lib/mailing-list";
import { addMailingMemberManually } from "~/lib/mailing-list.server";
import { listMailingMembers, unsubscribeMailingMember, type MailingMember } from "~/lib/mailing-provider.server";

const privateHeaders = { "Cache-Control": "private, no-store" };
export const headers = () => privateHeaders;
export const meta = () => [{ title: "Mailing list | Runoot Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const after = new URL(request.url).searchParams.get("after") || undefined;
  let members: MailingMember[] = [], hasMore = false, error = "";
  try { const page = await listMailingMembers(after); members = page.data; hasMore = page.has_more; }
  catch (cause) { error = cause instanceof Error ? cause.message : "Could not load subscribers."; }
  const pending = await supabaseAdmin.from("mailing_list_signups").select("id,email,requested_at").is("confirmed_at", null).gt("token_expires_at", new Date().toISOString()).order("requested_at", { ascending: false }).limit(25);
  return data({ members, hasMore, after, error, pending: pending.data || [], databaseReady: !pending.error }, { headers: privateHeaders });
}

export async function action({ request }: ActionFunctionArgs) {
  const admin = await requireAdmin(request);
  const fail = (error: string) => data({ error, message: "" }, { status: 400, headers: privateHeaders });
  if (request.method !== "POST" || request.headers.get("origin") !== new URL(request.url).origin) return fail("Please reload this page and try again.");
  try {
    const form = await request.formData();
    if (form.get("intent") === "add") {
      if (form.get("consent") !== "yes") return fail("Confirm that this person has already given permission to receive Runoot Last Minute.");
      await addMailingMemberManually(supabaseAdmin, parseMailingContact(form), admin.id);
      return data({ error: "", message: "Address added and subscription activated." }, { headers: privateHeaders });
    }
    if (form.get("intent") === "unsubscribe") {
      const id = String(form.get("id") || "");
      if (!/^[a-f0-9-]{36}$/i.test(id)) return fail("Select a valid subscriber.");
      await unsubscribeMailingMember(id);
      return data({ error: "", message: "Address unsubscribed from promotional emails." }, { headers: privateHeaders });
    }
    return fail("Unknown action.");
  } catch (cause) { return fail(cause instanceof Error ? cause.message : "Could not update the list."); }
}

export default function MailingSubscribers() {
  const { members, hasMore, after, error, pending, databaseReady } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  const input = "mt-1 block w-full rounded-lg border border-gray-300 p-2.5";
  return <div className="space-y-6">
    {(!databaseReady || error) && <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">{!databaseReady ? "The mailing list database needs to be installed. " : ""}{error}</p>}
    {!busy && result && <p role={result.error ? "alert" : "status"} className={`rounded-lg p-4 text-sm ${result.error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>{result.error || result.message}</p>}
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Add an address</h2><p className="mt-1 text-sm text-gray-600">Manual additions are active immediately. Website visitors confirm their email first.</p>
      <Form method="post" className="mt-4 space-y-4"><input type="hidden" name="intent" value="add" />
        <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium">Email<input className={input} type="email" name="email" required maxLength={254} /></label><label className="text-sm font-medium">First name (optional)<input className={input} name="firstName" maxLength={100} /></label><label className="text-sm font-medium">Last name (optional)<input className={input} name="lastName" maxLength={100} /></label></div>
        <label className="flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" name="consent" value="yes" required className="mt-1" />I confirm that this person has already consented to receive Runoot Last Minute by email.</label>
        <button disabled={busy || !databaseReady || Boolean(error)} className="rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50">Add subscriber</button>
      </Form>
    </section>
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Subscribers</h2><p className="mt-1 text-sm text-gray-600">Only active addresses receive campaigns. Unsubscribed addresses remain excluded.</p>
      <ul className="mt-4 divide-y divide-gray-100">{members.map(member => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="break-all font-medium">{member.email}</p><p className="text-sm text-gray-500">{[member.first_name, member.last_name].filter(Boolean).join(' ')} · {member.unsubscribed ? 'Unsubscribed' : 'Active'}</p></div>{!member.unsubscribed && <Form method="post"><input type="hidden" name="intent" value="unsubscribe" /><input type="hidden" name="id" value={member.id} /><button disabled={busy} className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">Unsubscribe</button></Form>}</li>)}</ul>
      {!members.length && !error && <p className="py-6 text-sm text-gray-500">No subscribers on this page.</p>}
      <nav aria-label="Subscriber pages" className="mt-4 flex gap-4 text-sm">{after && <Link to="/admin/mailing-list">← First page</Link>}{hasMore && <Link to={`?after=${encodeURIComponent(members.at(-1)?.id || '')}`}>Next 100 →</Link>}</nav>
    </section>
    {pending.length > 0 && <section className="rounded-xl border border-gray-200 bg-white p-5"><h2 className="text-lg font-semibold">Awaiting email confirmation</h2><p className="mt-1 text-sm text-gray-600">Most recent 25 requests with a valid confirmation link. These addresses have not activated their subscription.</p><ul className="mt-3 space-y-2 text-sm">{pending.map(item => <li className="break-all" key={item.id}>{item.email}</li>)}</ul></section>}
  </div>;
}
