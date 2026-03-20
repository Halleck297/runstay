import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export const meta: MetaFunction = () => [{ title: "Marathons - Admin - Runoot" }];

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const { data: events, error } = await supabaseAdmin
    .from("events")
    .select("id, name, location, location_i18n, country, country_i18n, event_date, slug, card_image_url")
    .order("event_date", { ascending: true });

  // Count active listings per event
  const { data: listingCounts } = await supabaseAdmin
    .from("listings")
    .select("event_id")
    .eq("status", "active")
    .eq("listing_mode", "event");

  const countMap: Record<string, number> = {};
  for (const row of listingCounts || []) {
    const eid = (row as any).event_id;
    if (eid) countMap[eid] = (countMap[eid] || 0) + 1;
  }

  return {
    events: (events || []).map((e: any) => ({
      ...e,
      activeListings: countMap[e.id] || 0,
      hasI18n: !!(e.location_i18n || e.country_i18n),
    })),
  };
}

export default function AdminMarathonsIndex() {
  const { events } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Marathons</h1>
          <p className="mt-1 text-sm text-gray-500">
            {events.length} event{events.length !== 1 ? "s" : ""} in the database
          </p>
        </div>
        <Link
          to="/admin/marathons/new"
          className="btn-primary rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          + Add Marathon
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/60">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-600">Event</th>
              <th className="hidden px-4 py-3 font-semibold text-gray-600 md:table-cell">Location</th>
              <th className="hidden px-4 py-3 font-semibold text-gray-600 sm:table-cell">Date</th>
              <th className="px-4 py-3 font-semibold text-gray-600 text-center">Listings</th>
              <th className="px-4 py-3 font-semibold text-gray-600 text-center">i18n</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {events.map((event: any) => (
              <tr key={event.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{event.name}</div>
                  <div className="text-xs text-gray-500 md:hidden">
                    {event.location ? `${event.location}, ` : ""}{event.country}
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-gray-600 md:table-cell">
                  {event.location ? `${event.location}, ` : ""}{event.country}
                </td>
                <td className="hidden px-4 py-3 text-gray-600 sm:table-cell">
                  {formatDate(event.event_date)}
                </td>
                <td className="px-4 py-3 text-center">
                  {event.activeListings > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                      {event.activeListings}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {event.hasI18n ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
                      Missing
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  No marathons yet. Click "Add Marathon" to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
