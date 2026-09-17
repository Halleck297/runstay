import { Form, Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export const meta = () => [{ title: "Bib requests | Runoot Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const url = new URL(request.url);
  const source = url.searchParams.get("source") || "all";
  const page = Math.max(1, Math.min(10000, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1));
  let query = supabaseAdmin.from("bib_requests").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (source === "qr" || source === "site") query = query.eq("source", source);
  const { data: requests, error, count } = await query.range((page - 1) * 50, page * 50 - 1);
  if (error) throw new Response("Unable to load bib requests. Please try again.", { status: 503 });
  return { requests: requests || [], count: count || 0, page, source };
}

export function headers() { return { "Cache-Control": "private, no-store" }; }

export default function BibRequestsAdmin() {
  const { requests, count, page, source } = useLoaderData<typeof loader>();
  return <main className="mx-auto max-w-7xl p-4 sm:p-8">
    <h1 className="text-2xl font-bold text-navy-900">Bib requests</h1>
    <p className="mt-2 text-sm text-gray-600">{count} race requests · One row per runner and race · QR = /go · Site = homepage or language homepage.</p>
    <p className="mt-2 text-sm text-gray-600">Email addresses are self-reported, not verified. Repeated requests for the same email and race retain the original request and source. Withdrawal requests arrive at support@runoot.com.</p>
    <Form method="get" className="my-6 flex items-end gap-3"><label className="text-sm font-medium">Source<select name="source" defaultValue={source} className="ml-3 rounded border border-gray-300 p-2"><option value="all">All</option><option value="qr">QR</option><option value="site">Site</option></select></label><button className="rounded bg-brand-600 px-4 py-2 text-sm text-white">Filter</button></Form>
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr>{["Received (UTC)", "Runner", "Email", "Race", "Looking for", "Source"].map(label => <th key={label} className="p-3 font-semibold">{label}</th>)}</tr></thead><tbody>{requests.map(row => <tr key={row.id} className="border-t border-gray-100"><td className="whitespace-nowrap p-3">{new Date(row.created_at).toISOString().slice(0, 16).replace("T", " ")}</td><td className="p-3">{row.first_name} {row.last_name}</td><td className="p-3">{row.email}</td><td className="p-3">{row.race}</td><td className="p-3">{row.preference === "both" ? "Both (bib or full package)" : row.preference === "bib" ? "Bib only" : "Full package"}</td><td className="p-3"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{row.source === "qr" ? "QR" : "Site"}</span></td></tr>)}</tbody></table>{requests.length === 0 && <p className="p-8 text-center text-gray-500">No requests yet.</p>}</div>
    <nav aria-label="Requests pagination" className="mt-5 flex gap-5 text-sm">{page > 1 && <Link to={`?source=${source}&page=${page - 1}`}>← Previous</Link>}<span>Page {page} / {Math.max(1, Math.ceil(count / 50))}</span>{page * 50 < count && <Link to={`?source=${source}&page=${page + 1}`}>Next →</Link>}</nav>
  </main>;
}
