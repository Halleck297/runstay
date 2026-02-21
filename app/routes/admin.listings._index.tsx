// app/routes/admin.listings.tsx - Admin Listings Management
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { useLoaderData, useActionData, useSearchParams, Form, Link, useNavigate } from "react-router";
import { useMemo, useState } from "react";
import { requireAdmin, logAdminAction } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import type { ListingStatus, ListingType } from "~/lib/database.types";
import { getListingPublicId } from "~/lib/publicIds";

export const meta: MetaFunction = () => {
  return [{ title: "Listings - Admin - Runoot" }];
};

const ITEMS_PER_PAGE = 20;
const STATUS_FILTERS = [
  { id: "", label: "All statuses" },
  { id: "pending", label: "Pending" },
  { id: "active", label: "Active" },
  { id: "sold", label: "Sold" },
  { id: "expired", label: "Expired" },
  { id: "rejected", label: "Rejected" },
] as const;
const TYPE_FILTERS = [
  { id: "", label: "All types" },
  { id: "room", label: "Hotel" },
  { id: "bib", label: "Bib" },
  { id: "room_and_bib", label: "Package" },
] as const;

export async function loader({ request }: LoaderFunctionArgs) {
  const admin = await requireAdmin(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const statusFilter = url.searchParams.get("status") || "";
  const typeFilter = url.searchParams.get("type") || "";
  const page = parseInt(url.searchParams.get("page") || "1");

  let query = supabaseAdmin
    .from("listings")
    .select(
      `*, author:profiles!listings_author_id_fkey(id, full_name, email, company_name, user_type, is_team_leader, role), reviewer:profiles!listings_reviewed_by_fkey(id, full_name, email, company_name), event:events(id, name, country, event_date)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

  const normalizedSearch = search.trim();
  if (normalizedSearch) {
    const safe = normalizedSearch.replace(/[,%()]/g, " ").trim();
    const like = `%${safe}%`;
    const [eventMatches, authorMatches] = await Promise.all([
      supabaseAdmin.from("events").select("id").ilike("name", like).limit(30),
      (supabaseAdmin as any)
        .from("profiles")
        .select("id")
        .or(`full_name.ilike.${like},company_name.ilike.${like}`)
        .limit(30),
    ]);
    const eventIds = (eventMatches.data || []).map((e: any) => e.id);
    const authorIds = (authorMatches.data || []).map((a: any) => a.id);
    const orFilters = [`title.ilike.${like}`];
    if (eventIds.length > 0) {
      orFilters.push(`event_id.in.(${eventIds.join(",")})`);
    }
    if (authorIds.length > 0) {
      orFilters.push(`author_id.in.(${authorIds.join(",")})`);
    }
    query = query.or(orFilters.join(","));
  }
  if (statusFilter) {
    const allowedStatuses: ListingStatus[] = ["pending", "active", "sold", "expired", "rejected"];
    if (allowedStatuses.includes(statusFilter as ListingStatus)) {
      query = query.eq("status", statusFilter as ListingStatus);
    }
  }
  if (typeFilter) {
    const allowedTypes: ListingType[] = ["room", "bib", "room_and_bib"];
    if (allowedTypes.includes(typeFilter as ListingType)) {
      query = query.eq("listing_type", typeFilter as ListingType);
    }
  }

  const { data: listings, count } = await query;

  return {
    admin,
    listings: listings || [],
    totalCount: count || 0,
    currentPage: page,
    totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE),
    activeStatus: statusFilter,
    activeType: typeFilter,
    initialSearch: search,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const actionType = formData.get("_action") as string;

  switch (actionType) {
    case "changeStatus": {
      const listingId = formData.get("listingId") as string;
      const newStatus = formData.get("newStatus") as string;

      if (!["pending", "active", "sold", "expired", "rejected"].includes(newStatus)) {
        return data({ error: "Invalid status" }, { status: 400 });
      }

      await (supabaseAdmin
        .from("listings") as any)
        .update({ status: newStatus })
        .eq("id", listingId);

      await logAdminAction((admin as any).id, "listing_status_changed", {
        targetListingId: listingId,
        details: { new_status: newStatus },
      });

      return data({ success: true });
    }

    case "delete": {
      const listingId = formData.get("listingId") as string;

      await supabaseAdmin
        .from("listings")
        .delete()
        .eq("id", listingId);

      await logAdminAction((admin as any).id, "listing_deleted", {
        targetListingId: listingId,
      });

      return data({ success: true });
    }

    default:
      return data({ error: "Unknown action" }, { status: 400 });
  }
}

const listingTypeLabels: Record<string, { label: string; color: string }> = {
  room: { label: "Hotel", color: "bg-blue-100 text-blue-700" },
  bib: { label: "Bib", color: "bg-purple-100 text-purple-700" },
  room_and_bib: { label: "Package", color: "bg-green-100 text-green-700" },
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  active: "bg-success-100 text-success-700",
  sold: "bg-gray-100 text-gray-600",
  expired: "bg-alert-100 text-alert-700",
  rejected: "bg-red-100 text-red-700",
};
function getAuthorBadge(author: any) {
  if (author?.role === "superadmin") return { label: "Superadmin", className: "bg-red-100 text-red-700" };
  if (author?.role === "admin") return { label: "Admin", className: "bg-purple-100 text-purple-700" };
  if (author?.is_team_leader) return { label: "Team Leader", className: "bg-indigo-100 text-indigo-700" };
  if (author?.user_type === "tour_operator") return { label: "Tour Operator", className: "bg-blue-100 text-blue-700" };
  return { label: "User", className: "bg-gray-100 text-gray-600" };
}

function formatDateStable(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export default function AdminListings() {
  const loaderData = useLoaderData<typeof loader>();
  if (!loaderData) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Loading listings...
      </div>
    );
  }
  const { listings, totalCount, currentPage, totalPages, activeStatus, activeType, initialSearch } = loaderData;
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState(initialSearch || "");
  const [searchOpen, setSearchOpen] = useState(false);

  const searchSuggestions = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    const items: { value: string; label: string }[] = [];
    for (const listing of listings as any[]) {
      const eventName = String(listing.event?.name || "").trim();
      const authorName = String(listing.author?.company_name || listing.author?.full_name || "").trim();
      if (eventName && eventName.toLowerCase().includes(q)) {
        const key = `event:${eventName.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({ value: eventName, label: `${eventName} · Event` });
        }
      }
      if (authorName && authorName.toLowerCase().includes(q)) {
        const key = `author:${authorName.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({ value: authorName, label: `${authorName} · User` });
        }
      }
      if (items.length >= 8) break;
    }
    return items;
  }, [searchInput, listings]);

  const statusHref = (statusId: string) => {
    const params = new URLSearchParams(searchParams);
    if (!statusId) params.delete("status");
    else params.set("status", statusId);
    params.set("page", "1");
    const q = params.toString();
    return q ? `/admin/listings?${q}` : "/admin/listings";
  };

  const typeHref = (typeId: string) => {
    const params = new URLSearchParams(searchParams);
    if (!typeId) params.delete("type");
    else params.set("type", typeId);
    params.set("page", "1");
    const q = params.toString();
    return q ? `/admin/listings?${q}` : "/admin/listings";
  };

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-900">Listings</h1>
        <p className="text-gray-500 mt-1">{totalCount} total listings</p>
      </div>

      {/* Action feedback */}
      {actionData && "error" in actionData && (
        <div className="mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm">
          {actionData.error}
        </div>
      )}

      {/* Search and filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <Form method="get" className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search by event or user..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 120)}
              className="input w-full"
            />
            <input type="hidden" name="search" value={searchInput} />
            <input type="hidden" name="status" value={activeStatus || ""} />
            <input type="hidden" name="type" value={activeType || ""} />
            {searchOpen && searchSuggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                {searchSuggestions.map((item, idx) => (
                  <button
                    key={`${item.value}-${idx}`}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onMouseDown={() => {
                      setSearchInput(item.value);
                      setSearchOpen(false);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="submit" className="btn-accent">
            Search
          </button>
        </Form>
        <div className="mt-3">
          <p className="text-[11px] font-medium text-gray-500 mb-1.5">Status</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <Link
                key={f.id || "all"}
                to={statusHref(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  (activeStatus || "") === f.id
                    ? "bg-navy-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <p className="text-[11px] font-medium text-gray-500 mb-1.5">Type</p>
          <div className="flex flex-wrap gap-2">
            {TYPE_FILTERS.map((f) => (
              <Link
                key={f.id || "all"}
                to={typeHref(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  (activeType || "") === f.id
                    ? "bg-navy-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Listings table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Listing</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Author</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Type</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Event</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Created</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {listings.map((listing: any) => {
                const typeInfo = listingTypeLabels[listing.listing_type] || { label: listing.listing_type, color: "bg-gray-100 text-gray-600" };

                return (
                  <tr
                    key={listing.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/admin/listings/${getListingPublicId(listing)}`)}
                  >
                    <td className="px-6 py-4">
                      <Link to={`/admin/listings/${getListingPublicId(listing)}`} className="text-sm font-medium text-gray-900 hover:text-brand-600">
                        {listing.title}
                      </Link>
                      {listing.price && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {listing.currency} {listing.price}
                          {listing.price_negotiable && " (negotiable)"}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const badge = getAuthorBadge(listing.author);
                        return (
                          <>
                            <p className="text-sm text-gray-700">
                              {listing.author?.company_name || listing.author?.full_name || "Unknown"}
                            </p>
                            <p className="text-xs text-gray-400">{listing.author?.email}</p>
                            <div className="mt-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.className}`}>
                                {badge.label}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <Form method="post" className="inline">
                        <input type="hidden" name="_action" value="changeStatus" />
                        <input type="hidden" name="listingId" value={listing.id} />
                        <select
                          name="newStatus"
                          defaultValue={listing.status}
                          onChange={(e) => e.target.form?.requestSubmit()}
                          className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${statusColors[listing.status] || ""}`}
                        >
                          <option value="pending">pending</option>
                          <option value="active">active</option>
                          <option value="sold">sold</option>
                          <option value="expired">expired</option>
                          <option value="rejected">rejected</option>
                        </select>
                      </Form>
                      {listing.reviewed_by && (
                        <p className="text-[11px] text-gray-500 mt-1">
                          by {listing.reviewer?.company_name || listing.reviewer?.full_name || "Admin"}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {listing.event?.name || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDateStable(listing.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Form method="post" className="inline" onSubmit={(e) => {
                          if (!confirm("Are you sure you want to delete this listing?")) {
                            e.preventDefault();
                          }
                        }}>
                          <input type="hidden" name="_action" value="delete" />
                          <input type="hidden" name="listingId" value={listing.id} />
                          <button
                            type="submit"
                            className="text-xs font-medium text-alert-500 hover:text-alert-700 px-2 py-1 rounded hover:bg-alert-50"
                            title="Delete listing"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </Form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {listings.map((listing: any) => {
            const typeInfo = listingTypeLabels[listing.listing_type] || { label: listing.listing_type, color: "bg-gray-100 text-gray-600" };

            return (
              <div
                key={listing.id}
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => navigate(`/admin/listings/${getListingPublicId(listing)}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    {(() => {
                      const badge = getAuthorBadge(listing.author);
                      return (
                        <>
                          <Link to={`/admin/listings/${getListingPublicId(listing)}`} className="text-sm font-medium text-gray-900 hover:text-brand-600">
                            {listing.title}
                          </Link>
                          <p className="text-xs text-gray-500 mt-0.5">
                            by {listing.author?.company_name || listing.author?.full_name || "Unknown"}
                          </p>
                          <div className="mt-1">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.className}`}>
                              {badge.label}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[listing.status] || ""}`}>
                      {listing.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-xs text-gray-500">
                    {listing.event?.name} · {formatDateStable(listing.created_at)}
                    {listing.price && (
                      <span> · {listing.currency} {listing.price}</span>
                    )}
                    {listing.reviewed_by && (
                      <span> · reviewed by {listing.reviewer?.company_name || listing.reviewer?.full_name || "Admin"}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Form method="post" className="inline">
                      <input type="hidden" name="_action" value="changeStatus" />
                      <input type="hidden" name="listingId" value={listing.id} />
                      <select
                        name="newStatus"
                        defaultValue={listing.status}
                        onChange={(e) => e.target.form?.requestSubmit()}
                        className="text-xs px-2 py-1 rounded bg-gray-50 border-0"
                      >
                        <option value="active">active</option>
                        <option value="sold">sold</option>
                        <option value="expired">expired</option>
                      </select>
                    </Form>
                    <Form method="post" className="inline" onSubmit={(e) => {
                      if (!confirm("Delete this listing?")) e.preventDefault();
                    }}>
                      <input type="hidden" name="_action" value="delete" />
                      <input type="hidden" name="listingId" value={listing.id} />
                      <button type="submit" className="text-xs text-alert-500 px-2 py-1 rounded bg-gray-50">
                        Delete
                      </button>
                    </Form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {listings.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">
            No listings found
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link
              to={`/admin/listings?page=${currentPage - 1}&search=${searchParams.get("search") || ""}&status=${searchParams.get("status") || ""}&type=${searchParams.get("type") || ""}`}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              to={`/admin/listings?page=${currentPage + 1}&search=${searchParams.get("search") || ""}&status=${searchParams.get("status") || ""}&type=${searchParams.get("type") || ""}`}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
