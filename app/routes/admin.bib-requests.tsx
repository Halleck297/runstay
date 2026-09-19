import { useState } from "react";
import { data, Form, Link, useActionData, useLoaderData, useNavigation, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { deleteRunnerRequests, loadRunnerRequests, parseRequestDeletion, type RequestSource, type RunnerRequest } from "~/lib/admin-bib-requests.server";

export const meta = () => [{ title: "Bib requests | Runoot Admin" }];
const privateHeaders = { "Cache-Control": "private, no-store" };

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const url = new URL(request.url);
  const rawSource = url.searchParams.get("source");
  const source: RequestSource = rawSource === "qr" || rawSource === "site" ? rawSource : "all";
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  try {
    return { ...await loadRunnerRequests(supabaseAdmin, source, page), source };
  } catch {
    throw new Response("Unable to load bib requests. Please try again.", { status: 503, headers: privateHeaders });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const fail = (error: string, status = 400) => data({ error, message: "" }, { status, headers: privateHeaders });
  if (request.method !== "POST") return fail("Method not allowed.", 405);
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return fail("Please reload this page and try again.", 403);
  }
  let form: FormData;
  try { form = await request.formData(); } catch { return fail("Invalid request. Please reload and try again."); }
  const selection = parseRequestDeletion(form);
  if (!selection) return fail("Select a valid request to delete.");
  try {
    const count = await deleteRunnerRequests(supabaseAdmin, selection);
    const message = count ? `Request deleted for ${selection.email} (${count} ${count === 1 ? "race" : "races"}).` : "The selected requests have already been deleted.";
    return data({ error: "", message }, { headers: privateHeaders });
  } catch {
    return fail("We couldn’t delete the request. Please try again.", 503);
  }
}

export function headers() { return privateHeaders; }

function receivedAt(value: string) {
  return new Date(value).toISOString().slice(0, 16).replace("T", " ");
}

function RequestCard({ request, source, busy }: { request: RunnerRequest; source: RequestSource; busy: boolean }) {
  const [confirming, setConfirming] = useState(false);
  return <article className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="break-words text-lg font-semibold text-navy-900">{request.firstName} {request.lastName}</h2>
        <p className="break-all text-sm text-gray-700">{request.email}</p>
        <p className="mt-1 text-xs text-gray-500">Latest request: {receivedAt(request.latestRequestAt)} UTC · {request.races.length} {request.races.length === 1 ? "race" : "races"}</p>
      </div>
      {!confirming && <button type="button" disabled={busy} onClick={() => setConfirming(true)} aria-label={`Delete request for ${request.email}`} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Delete request</button>}
    </div>
    <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Requested races">
      {request.races.map(race => <li key={race.id} className="min-w-0 rounded-lg bg-gray-50 p-3">
        <div className="flex items-start justify-between gap-2"><h3 className="min-w-0 break-words font-semibold text-navy-900">{race.race}</h3><span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{race.source === "qr" ? "QR" : "Site"}</span></div>
        <p className="mt-1 text-sm text-gray-700">{race.preference === "both" ? "Bib or full package" : race.preference === "bib" ? "Bib only" : "Full package"}</p>
        <p className="mt-1 text-xs text-gray-500">{receivedAt(race.created_at)} UTC</p>
      </li>)}
    </ul>
    {confirming && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-semibold text-red-900">Delete this request for {request.email}?</p>
      <p className="mt-1 break-words text-sm text-red-800">This permanently removes {request.races.map(race => race.race).join(", ")}. This cannot be undone.</p>
      {source !== "all" && <p className="mt-1 text-sm text-red-800">Only the races shown for the {source === "qr" ? "QR" : "Site"} filter will be deleted.</p>}
      <Form method="post" className="mt-3 flex flex-wrap gap-3">
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="email" value={request.email} />
        {request.races.map(race => <input key={race.id} type="hidden" name="requestId" value={race.id} />)}
        <button disabled={busy} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">{busy ? "Deleting…" : "Confirm deletion"}</button>
        <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50">Cancel</button>
      </Form>
    </div>}
  </article>;
}

export default function BibRequestsAdmin() {
  const { requests, count, raceCount, page, pageSize, source } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  return <main className="mx-auto max-w-7xl p-4 sm:p-8">
    <h1 className="text-2xl font-bold text-navy-900">Bib requests</h1>
    <p className="mt-2 text-sm text-gray-600">{count} {count === 1 ? "runner" : "runners"} · {raceCount} {raceCount === 1 ? "race" : "races"} · Requests grouped by email address.</p>
    <p className="mt-2 text-sm text-gray-600">QR = /go · Site = homepage or language homepage. Email addresses are self-reported, not verified.</p>
    <Form method="get" className="my-6 flex flex-wrap items-end gap-3"><label className="text-sm font-medium">Source<select key={source} name="source" defaultValue={source} className="ml-3 rounded border border-gray-300 p-2"><option value="all">All</option><option value="qr">QR</option><option value="site">Site</option></select></label><button disabled={busy} className="rounded bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50">Filter</button></Form>
    {!busy && result?.error && <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{result.error}</p>}
    {!busy && result?.message && <p role="status" className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{result.message}</p>}
    <div className="space-y-4">{requests.map(request => <RequestCard key={`${source}:${request.email}`} request={request} source={source} busy={busy} />)}{!requests.length && <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">{source === "all" ? "No requests yet." : "No requests from this source."}</p>}</div>
    <nav aria-label="Requests pagination" className="mt-5 flex gap-5 text-sm">{page > 1 && <Link to={`?source=${source}&page=${page - 1}`}>← Previous</Link>}<span>Page {page} / {Math.max(1, Math.ceil(count / pageSize))}</span>{page * pageSize < count && <Link to={`?source=${source}&page=${page + 1}`}>Next →</Link>}</nav>
  </main>;
}
