import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { useLoaderData, Link, Form } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { invalidateCacheByPrefix } from "~/lib/cache.server";

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

  const { data: events } = await supabaseAdmin
    .from("events")
    .select("id, name, location, location_i18n, country, country_i18n, event_date, slug, card_image_url")
    .eq("event_type", "marathon")
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

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const eventId = String(formData.get("eventId") || "");

  if (intent !== "delete" || !eventId) {
    return data({ error: "Invalid request." }, { status: 400 });
  }

  // Block deletion if event has any listings (not just active)
  const { count } = await supabaseAdmin
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (count && count > 0) {
    return data(
      { error: `Cannot delete: this event has ${count} listing${count > 1 ? "s" : ""} linked to it.` },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("events")
    .delete()
    .eq("id", eventId);

  if (error) return data({ error: `Failed to delete: ${error.message}` }, { status: 400 });

  invalidateCacheByPrefix("events:");
  return data({ success: true });
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
              <th className="px-4 py-3 font-semibold text-gray-600 text-right">Actions</th>
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
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      to={`/admin/marathons/${event.id}/edit`}
                      className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    <Form
                      method="post"
                      onSubmit={(e) => {
                        if (!confirm(
                          event.activeListings > 0
                            ? `Warning: "${event.name}" has ${event.activeListings} active listing${event.activeListings > 1 ? "s" : ""}.\n\nAre you sure you want to delete this event? This action cannot be undone.`
                            : `Are you sure you want to delete "${event.name}"? This action cannot be undone.`
                        )) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="eventId" value={event.id} />
                      <button
                        type="submit"
                        className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </Form>
                  </div>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
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
