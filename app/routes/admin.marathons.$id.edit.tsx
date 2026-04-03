import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, useActionData, useLoaderData, useNavigate } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { invalidateCacheByPrefix } from "~/lib/cache.server";
import { DatePicker } from "~/components/DatePicker";

export const meta: MetaFunction = () => [{ title: "Edit Marathon - Admin - Runoot" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id, name, location, country, event_date, finish_lat, finish_lng")
    .eq("id", params.id as string)
    .single();

  if (!event) throw new Response("Not Found", { status: 404 });

  return { event };
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();

  const name = String(formData.get("name") || "").trim();
  const eventDate = String(formData.get("eventDate") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const country = String(formData.get("country") || "").trim();
  const finishLat = String(formData.get("finishLat") || "").trim();
  const finishLng = String(formData.get("finishLng") || "").trim();

  if (!name) return data({ error: "Event name is required." }, { status: 400 });
  if (!eventDate) return data({ error: "Event date is required." }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("events")
    .update({
      name,
      event_date: eventDate,
      location: location || null,
      country: country || "TBD",
      finish_lat: finishLat ? parseFloat(finishLat) : null,
      finish_lng: finishLng ? parseFloat(finishLng) : null,
    } as any)
    .eq("id", params.id as string);

  if (error) return data({ error: `Failed to update: ${error.message}` }, { status: 400 });

  invalidateCacheByPrefix("events:");
  return redirect("/admin/marathons");
}

export default function AdminMarathonEdit() {
  const { event } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Edit Marathon</h1>
          <p className="mt-1 text-sm text-gray-500">{event.name}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/marathons")}
          className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
      </div>

      {actionData && typeof actionData === "object" && "error" in actionData && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionData.error as string}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <Form method="post" className="space-y-6">
          <div>
            <label className="label">Event name</label>
            <input
              name="name"
              className="input"
              defaultValue={event.name}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">City</label>
              <input
                name="location"
                className="input"
                defaultValue={event.location || ""}
                placeholder="e.g. Barcelona"
              />
            </div>
            <div>
              <label className="label">Country</label>
              <input
                name="country"
                className="input"
                defaultValue={event.country}
                placeholder="e.g. Spain"
              />
            </div>
          </div>

          <div>
            <label className="label">Event date</label>
            <DatePicker
              name="eventDate"
              id="eventDate"
              placeholder="Select event date"
              defaultValue={event.event_date}
            />
          </div>

          <div>
            <label className="label">Finish line coordinates (optional)</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  name="finishLat"
                  type="number"
                  step="any"
                  className="input"
                  placeholder="e.g. 41.3907"
                  defaultValue={event.finish_lat ?? ""}
                />
                <p className="mt-1 text-xs text-gray-400">Latitude (N = positive)</p>
              </div>
              <div>
                <input
                  name="finishLng"
                  type="number"
                  step="any"
                  className="input"
                  placeholder="e.g. 2.1812"
                  defaultValue={event.finish_lng ?? ""}
                />
                <p className="mt-1 text-xs text-gray-400">Longitude (E = positive)</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-gray-200 pt-6">
            <button type="submit" className="btn-primary rounded-full px-6">
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin/marathons")}
              className="rounded-full border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
