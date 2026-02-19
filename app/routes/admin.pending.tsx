// app/routes/admin.pending.tsx - Pending Listings Approval Queue
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { useLoaderData, useActionData, Form, Link } from "react-router";
import { requireAdmin, logAdminAction } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export const meta: MetaFunction = () => {
  return [{ title: "Pending Approvals - Admin - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const admin = await requireAdmin(request);

  const { data: listings, count } = await (supabaseAdmin as any)
    .from("listings")
    .select(
      `*, author:profiles(id, full_name, email, company_name, user_type, is_verified),
       event:events(id, name, country, event_date)`,
      { count: "exact" }
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return { admin, listings: listings || [], pendingCount: count || 0 };
}

export async function action({ request }: ActionFunctionArgs) {
  const admin = await requireAdmin(request);
  const adminId = (admin as any).id as string;
  const formData = await request.formData();
  const actionType = formData.get("_action") as string;
  const listingId = formData.get("listingId") as string;
  const adminNote = (formData.get("adminNote") as string)?.trim() || null;

  if (!listingId) {
    return data({ error: "Missing listing ID" }, { status: 400 });
  }

  // Fetch the listing for notification
  const { data: listing } = await (supabaseAdmin as any)
    .from("listings")
    .select("id, title, author_id")
    .eq("id", listingId)
    .single();

  if (!listing) {
    return data({ error: "Listing not found" }, { status: 404 });
  }

  switch (actionType) {
    case "approve": {
      await (supabaseAdmin as any)
        .from("listings")
        .update({
          status: "active",
          admin_note: adminNote,
          reviewed_at: new Date().toISOString(),
          reviewed_by: adminId,
        })
        .eq("id", listingId);

      // Notify the author
      await (supabaseAdmin as any).from("notifications").insert({
        user_id: listing.author_id,
        type: "listing_approved",
        title: "Your listing has been approved!",
        message: `"${listing.title}" is now live and visible to other users.`,
        data: { listing_id: listingId },
      });

      await logAdminAction(adminId, "listing_approved", {
        targetListingId: listingId,
        details: { admin_note: adminNote },
      });

      return data({ success: true, action: "approved", title: listing.title });
    }

    case "reject": {
      await (supabaseAdmin as any)
        .from("listings")
        .update({
          status: "rejected",
          admin_note: adminNote,
          reviewed_at: new Date().toISOString(),
          reviewed_by: adminId,
        })
        .eq("id", listingId);

      // Notify the author
      await (supabaseAdmin as any).from("notifications").insert({
        user_id: listing.author_id,
        type: "listing_rejected",
        title: "Your listing needs changes",
        message: adminNote
          ? `"${listing.title}" was not approved: ${adminNote}`
          : `"${listing.title}" was not approved. Please contact us for details.`,
        data: { listing_id: listingId },
      });

      await logAdminAction(adminId, "listing_rejected", {
        targetListingId: listingId,
        details: { admin_note: adminNote },
      });

      return data({ success: true, action: "rejected", title: listing.title });
    }

    default:
      return data({ error: "Unknown action" }, { status: 400 });
  }
}

const listingTypeLabels: Record<string, string> = {
  room: "Room",
  bib: "Bib",
  room_and_bib: "Room + Bib",
};

const listingTypeColors: Record<string, string> = {
  room: "bg-blue-100 text-blue-700",
  bib: "bg-purple-100 text-purple-700",
  room_and_bib: "bg-accent-100 text-accent-700",
};

export default function AdminPending() {
  const { listings, pendingCount } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-900">
            Pending Approvals
          </h1>
          {pendingCount > 0 && (
            <span className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-accent-500 px-2 text-sm font-bold text-white">
              {pendingCount}
            </span>
          )}
        </div>
        <p className="text-gray-500 mt-1">Review and approve listings before they go live</p>
      </div>

      {/* Action feedback */}
      {actionData && (actionData as any).success && (
        <div className={`mb-6 rounded-lg border px-4 py-3 text-sm font-medium ${
          (actionData as any).action === "approved"
            ? "bg-success-50 border-success-200 text-success-700"
            : "bg-alert-50 border-alert-200 text-alert-700"
        }`}>
          {(actionData as any).action === "approved"
            ? `"${(actionData as any).title}" has been approved and is now live.`
            : `"${(actionData as any).title}" has been rejected.`}
        </div>
      )}
      {actionData && (actionData as any).error && (
        <div className="mb-6 rounded-lg border bg-red-50 border-red-200 px-4 py-3 text-sm font-medium text-red-700">
          {(actionData as any).error}
        </div>
      )}

      {/* Listings queue */}
      {listings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-display font-semibold text-gray-900 text-lg mb-2">
            All clear!
          </h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            No listings are waiting for review. New submissions will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {listings.map((listing: any) => (
            <div key={listing.id} className="bg-white rounded-xl border border-gray-200 p-5">
              {/* Header row */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <Link
                    to={`/listings/${listing.id}`}
                    target="_blank"
                    className="font-display font-semibold text-gray-900 hover:text-brand-600 transition-colors"
                  >
                    {listing.title}
                  </Link>
                  <p className="text-sm text-gray-500 mt-0.5">
                    by{" "}
                    <span className="font-medium text-gray-700">
                      {listing.author?.company_name || listing.author?.full_name}
                    </span>
                    {" · "}
                    {listing.author?.email}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {/* User type badge */}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    listing.author?.user_type === "tour_operator"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {listing.author?.user_type === "tour_operator" ? "Tour Operator" : "Private"}
                  </span>
                  {/* Listing type badge */}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    listingTypeColors[listing.listing_type] || "bg-gray-100 text-gray-600"
                  }`}>
                    {listingTypeLabels[listing.listing_type] || listing.listing_type}
                  </span>
                  {/* Verified badge */}
                  {listing.author?.is_verified && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-700">
                      Verified
                    </span>
                  )}
                </div>
              </div>

              {/* Details row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mb-4">
                {listing.event && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {listing.event.name} · {listing.event.country}
                  </span>
                )}
                {listing.event?.event_date && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Event: {new Date(listing.event.event_date).toLocaleDateString()}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Submitted: {new Date(listing.created_at).toLocaleDateString()}
                </span>
                {listing.price && (
                  <span className="font-medium text-gray-900">
                    {listing.currency} {listing.price.toLocaleString()}
                    {listing.price_negotiable && " (negotiable)"}
                  </span>
                )}
              </div>

              {/* Description preview */}
              {listing.description && (
                <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                  {listing.description}
                </p>
              )}

              {/* Quick details */}
              <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-4">
                {listing.hotel_name && (
                  <span className="bg-gray-50 px-2 py-1 rounded">
                    Hotel: {listing.hotel_name}
                    {listing.hotel_stars && ` (${listing.hotel_stars}★)`}
                  </span>
                )}
                {listing.room_count && (
                  <span className="bg-gray-50 px-2 py-1 rounded">
                    {listing.room_count} room{listing.room_count > 1 ? "s" : ""}
                  </span>
                )}
                {listing.bib_count && (
                  <span className="bg-gray-50 px-2 py-1 rounded">
                    {listing.bib_count} bib{listing.bib_count > 1 ? "s" : ""}
                  </span>
                )}
                {listing.transfer_type && (
                  <span className="bg-gray-50 px-2 py-1 rounded">
                    Transfer: {listing.transfer_type.replace("_", " ")}
                  </span>
                )}
              </div>

              {/* Approve / Reject forms */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Form method="post" className="flex-1">
                    <input type="hidden" name="_action" value="approve" />
                    <input type="hidden" name="listingId" value={listing.id} />
                    <textarea
                      name="adminNote"
                      placeholder="Optional note (visible to user)..."
                      className="input w-full mb-2 text-sm"
                      rows={2}
                    />
                    <button
                      type="submit"
                      className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Approve
                    </button>
                  </Form>
                  <Form method="post" className="flex-1">
                    <input type="hidden" name="_action" value="reject" />
                    <input type="hidden" name="listingId" value={listing.id} />
                    <textarea
                      name="adminNote"
                      placeholder="Reason for rejection (shown to user)..."
                      className="input w-full mb-2 text-sm"
                      rows={2}
                    />
                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-medium text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Reject
                    </button>
                  </Form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
