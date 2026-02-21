import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, Link, useLoaderData } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { applyListingPublicIdFilter, getListingPublicId } from "~/lib/publicIds";

export const meta: MetaFunction<typeof loader> = ({ data: loaderData }) => {
  const title = loaderData?.listing?.title || "Listing";
  return [{ title: `${title} - Admin Listing - Runoot` }];
};

function formatDateStable(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hh}:${mm} UTC`;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const id = params.id;
  if (!id) {
    throw new Response("Listing not found", { status: 404 });
  }

  const listingQuery = supabaseAdmin
    .from("listings")
    .select(
      `
      *,
      author:profiles!listings_author_id_fkey(id, full_name, email, company_name, user_type),
      reviewer:profiles!listings_reviewed_by_fkey(id, full_name, email, company_name),
      event:events(id, name, country, event_date)
    `
    );
  const { data: listing } = await applyListingPublicIdFilter(listingQuery as any, id).single();

  if (!listing) {
    throw new Response("Listing not found", { status: 404 });
  }

  return data({ listing });
}

export default function AdminListingDetail() {
  const { listing } = useLoaderData<typeof loader>();
  const l = listing as any;
  const publicId = getListingPublicId(l);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/listings" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to listings
        </Link>
        <h1 className="mt-2 font-display text-2xl md:text-3xl font-bold text-gray-900">{l.title || "Untitled listing"}</h1>
        <p className="text-gray-500 mt-1">Listing ID: {getListingPublicId(l)}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Status</p>
            <p className="font-medium text-gray-900">{l.status || "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">Type</p>
            <p className="font-medium text-gray-900">{l.listing_type || "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">Price</p>
            <p className="font-medium text-gray-900">
              {l.price ? `${l.currency || ""} ${l.price}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Created</p>
            <p className="font-medium text-gray-900">{formatDateStable(l.created_at)}</p>
          </div>
          <div>
            <p className="text-gray-500">Updated</p>
            <p className="font-medium text-gray-900">{formatDateStable(l.updated_at)}</p>
          </div>
          <div>
            <p className="text-gray-500">Reviewed by</p>
            <p className="font-medium text-gray-900">
              {l.reviewer?.company_name || l.reviewer?.full_name || "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Author & Event</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Author</p>
            <p className="font-medium text-gray-900">{l.author?.company_name || l.author?.full_name || "—"}</p>
            <p className="text-gray-500">{l.author?.email || ""}</p>
          </div>
          <div>
            <p className="text-gray-500">Event</p>
            <p className="font-medium text-gray-900">{l.event?.name || "—"}</p>
            <p className="text-gray-500">
              {l.event?.country || ""}{l.event?.event_date ? ` · ${formatDateStable(l.event.event_date)}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Public page</h2>
        {l.status === "active" ? (
          <a
            href={`/listings/${publicId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center px-3 py-2 rounded-full bg-gray-100 text-sm text-gray-800 hover:bg-gray-200"
          >
            Open public listing page
          </a>
        ) : (
          <div>
            <button
              type="button"
              disabled
              className="inline-flex items-center px-3 py-2 rounded-full bg-gray-100 text-sm text-gray-400 cursor-not-allowed"
            >
              Open public listing page
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Available only when listing status is <span className="font-medium">active</span>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
