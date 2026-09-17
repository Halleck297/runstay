import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
export const meta = () => [{ title: "Bib offers | Runoot Admin" }];
export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const page = Math.max(1, Math.min(10000, Number.parseInt(new URL(request.url).searchParams.get("page") || "1", 10) || 1));
  const { data, error, count } = await supabaseAdmin.from("bib_offers").select("*", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * 50, page * 50 - 1);
  if (error) throw new Response("Unable to load offers. Please try again.", { status: 503 });
  return { offers: data || [], count: count || 0, page };
}
export function headers() { return { "Cache-Control": "private, no-store" }; }
export default function BibOffersAdmin() {
  const { offers, count, page } = useLoaderData<typeof loader>();
  return <main className="mx-auto max-w-7xl p-4 sm:p-8"><h1 className="text-2xl font-bold text-navy-900">Bib offers</h1><p className="mt-2 text-sm text-gray-600">{count} offers · Private reports awaiting manual review. Identity, availability and transfer conditions are self-reported, not verified.</p><div className="mt-6 space-y-4">{offers.map(offer => <article className="rounded-xl border border-gray-200 bg-white p-5" key={offer.id}><div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-semibold">{offer.race} · {offer.race_date}</h2><span className="text-sm text-gray-500">Received {offer.created_at.slice(0, 16).replace("T", " ")} UTC</span></div><p className="mt-2">{offer.first_name} {offer.last_name} · {offer.email}{offer.phone && ` · ${offer.phone}`}</p><p className="mt-1 text-sm text-gray-700">{offer.entry_type === "bib" ? "Bib only" : "Full package"} · {offer.price === null ? "Price not specified" : `${offer.price} ${offer.currency} per entry/package`}</p><p className="mt-2 text-sm"><strong>Transfer:</strong> {offer.transfer_status === "official_transfer" ? "Official transfer reported" : "Unknown — needs review"}{offer.deadline && ` · Deadline: ${offer.deadline}`}</p>{offer.notes && <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{offer.notes}</p>}</article>)}{!offers.length && <p className="py-8 text-center text-gray-500">No offers yet.</p>}</div><nav aria-label="Offers pagination" className="mt-5 flex gap-5 text-sm">{page > 1 && <Link to={`?page=${page - 1}`}>Previous</Link>}<span>Page {page} / {Math.max(1, Math.ceil(count / 50))}</span>{page * 50 < count && <Link to={`?page=${page + 1}`}>Next</Link>}</nav></main>;
}
