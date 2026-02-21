import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { useMemo, useState } from "react";
import { requireSuperAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { sendTemplatedEmail } from "~/lib/email/service.server";

const STATUS_OPTIONS = [
  "submitted",
  "quoting",
  "approved_for_event_draft",
  "draft_submitted",
  "published",
] as const;

export const meta: MetaFunction = () => [{ title: "Event Requests - Admin - Runoot" }];

function formatDateStable(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function getUpdateAuthorMeta(update: any) {
  if (update?.actor_role === "team_leader" && update?.action === "created_submitted") {
    return {
      label: "TL · Creation",
      className: "bg-indigo-100 text-indigo-700",
    };
  }
  if (update?.actor_role === "team_leader") {
    return {
      label: "TL",
      className: "bg-indigo-100 text-indigo-700",
    };
  }
  if (update?.actor_role === "superadmin") {
    return {
      label: "Admin",
      className: "bg-brand-100 text-brand-700",
    };
  }
  return {
    label: "System",
    className: "bg-gray-100 text-gray-700",
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireSuperAdmin(request);

  const { data: requests } = await (supabaseAdmin.from("event_requests") as any)
    .select("*, team_leader:profiles!event_requests_team_leader_id_fkey(id, full_name, email)")
    .order("created_at", { ascending: false });

  const requestIds = (requests || []).map((r: any) => r.id);
  let updatesByRequest: Record<string, any[]> = {};

  if (requestIds.length > 0) {
    const { data: updates } = await (supabaseAdmin.from("event_request_updates") as any)
      .select("id, event_request_id, actor_role, action, note, created_at")
      .in("event_request_id", requestIds)
      .order("created_at", { ascending: false });

    updatesByRequest = (updates || []).reduce((acc: Record<string, any[]>, row: any) => {
      if (!acc[row.event_request_id]) acc[row.event_request_id] = [];
      acc[row.event_request_id].push(row);
      return acc;
    }, {});
  }

  return { requests: requests || [], updatesByRequest };
}

export async function action({ request }: ActionFunctionArgs) {
  const admin = await requireSuperAdmin(request);
  const formData = await request.formData();
  const actionType = String(formData.get("_action") || "");
  const requestId = String(formData.get("requestId") || "");
  const note = String(formData.get("note") || "").trim();

  if (!requestId) return data({ error: "Missing request id." }, { status: 400 });

  const { data: existing } = await (supabaseAdmin.from("event_requests") as any)
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (!existing) return data({ error: "Request not found." }, { status: 404 });

  if (actionType === "deleteNote") {
    const noteId = String(formData.get("noteId") || "");
    if (!noteId) return data({ error: "Missing note id." }, { status: 400 });

    await (supabaseAdmin.from("event_request_updates") as any)
      .delete()
      .eq("id", noteId)
      .eq("event_request_id", requestId);

    return data({ success: true, message: "Note deleted." });
  }

  if (actionType === "setStatus") {
    const nextStatus = String(formData.get("nextStatus") || "");
    if (!STATUS_OPTIONS.includes(nextStatus as any)) {
      return data({ error: "Invalid status." }, { status: 400 });
    }

    const selectedAgency = String(formData.get("selectedAgencyName") || "").trim();
    const quoteSummary = String(formData.get("quoteSummary") || "").trim();
    const internalAdminNote = String(formData.get("internalAdminNote") || "").trim();

    const patch: Record<string, any> = {
      status: nextStatus,
      selected_agency_name: selectedAgency || null,
      quote_summary: quoteSummary || null,
      internal_admin_note: internalAdminNote || null,
      updated_at: new Date().toISOString(),
    };

    await (supabaseAdmin.from("event_requests") as any)
      .update(patch)
      .eq("id", requestId);

    if (note) {
      await (supabaseAdmin.from("event_request_updates") as any).insert({
        event_request_id: requestId,
        actor_id: (admin as any).id,
        actor_role: "superadmin",
        action: `status_changed_to_${nextStatus}`,
        note,
      });
    }

    return data({ success: true, message: `Status updated to ${nextStatus}.` });
  }

  if (actionType === "publishAndNotify") {
    const listingUrl = String(formData.get("listingUrl") || "").trim();
    if (!listingUrl) return data({ error: "Listing URL is required." }, { status: 400 });
    if (existing.status !== "draft_submitted") {
      return data({ error: "You can publish only after TL submits the event draft." }, { status: 400 });
    }

    await (supabaseAdmin.from("event_requests") as any)
      .update({
        status: "published",
        published_listing_url: listingUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (note) {
      await (supabaseAdmin.from("event_request_updates") as any).insert({
        event_request_id: requestId,
        actor_id: (admin as any).id,
        actor_role: "superadmin",
        action: "published_and_notified",
        note,
      });
    }

    // Notify + email ALL TL referrals (registered/active/inactive)
    const { data: referralRows } = await supabaseAdmin
      .from("referrals")
      .select("referred_user_id")
      .eq("team_leader_id", existing.team_leader_id);

    const referralIds = Array.from(new Set((referralRows || []).map((r: any) => r.referred_user_id).filter(Boolean)));
    if (referralIds.length > 0) {
      const { data: referralProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email")
        .in("id", referralIds);

      for (const profile of referralProfiles || []) {
        await (supabaseAdmin.from("notifications") as any).insert({
          user_id: profile.id,
          type: "system",
          title: "New Team Event Published",
          message: `${existing.event_name} has been published in listings.`,
          data: { kind: "team_event_published", event_request_id: requestId, listing_url: listingUrl },
        });

        await sendTemplatedEmail({
          to: profile.email,
          templateId: "platform_notification",
          locale: null,
          payload: {
            title: "New Team Event Published",
            message: `${existing.event_name} is now available in listings.`,
            ctaLabel: "Open listing",
            ctaUrl: listingUrl,
          },
        });
      }
    }

    const { data: tlProfile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", existing.team_leader_id)
      .maybeSingle();

    if (tlProfile?.email) {
      await sendTemplatedEmail({
        to: tlProfile.email,
        templateId: "platform_notification",
        locale: null,
        payload: {
          title: "Your event is now published",
          message: `${existing.event_name} has been approved and is now live in listings.`,
          ctaLabel: "Open listing",
          ctaUrl: listingUrl,
        },
      });
    }

    return data({ success: true, message: `Published and notified ${referralIds.length} referrals.` });
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function AdminEventRequestsPage() {
  const { requests, updatesByRequest } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as { error?: string; success?: boolean; message?: string } | undefined;
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  const sortedRequests = useMemo(() => requests || [], [requests]);

  function toggleRow(id: string) {
    setOpenRows((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleNote(noteId: string) {
    setExpandedNotes((prev) => ({ ...prev, [noteId]: !prev[noteId] }));
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-900">Event Requests</h1>
        <p className="text-gray-500 mt-1">Superadmin workflow for TL event request quoting and publication.</p>
      </div>

      {actionData?.error && (
        <div className="mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm">{actionData.error}</div>
      )}
      {actionData?.success && actionData.message && (
        <div className="mb-4 p-3 rounded-lg bg-success-50 text-success-700 text-sm">{actionData.message}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {sortedRequests.length > 0 ? (
            sortedRequests.map((req: any) => (
              <div key={req.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-gray-900">{req.event_name}</p>
                    <p className="text-sm text-gray-600">
                      {req.event_location} · {formatDateStable(req.event_date)} · {req.request_type} · {req.people_count} people
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      TL: {(req.team_leader?.full_name || req.team_leader?.email || "Unknown").toString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleRow(req.id)}
                    className="h-10 px-4 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold shadow-md shadow-brand-500/30"
                    aria-label={openRows[req.id] ? "Close details" : "Open details"}
                  >
                    {openRows[req.id] ? "Close" : "Open"}
                  </button>
                </div>

                {openRows[req.id] && (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                    <p className="text-base text-gray-700"><span className="font-semibold text-gray-900">Status:</span> {req.status}</p>
                    {req.public_note && <p className="text-base text-gray-700"><span className="font-semibold text-gray-900">Announcement note (public):</span> {req.public_note}</p>}
                    {req.notes && <p className="text-base text-gray-700"><span className="font-semibold text-gray-900">Quoting notes:</span> {req.notes}</p>}
                    {req.quote_summary && <p className="text-base text-gray-700"><span className="font-semibold text-gray-900">Quote summary:</span> {req.quote_summary}</p>}
                    {req.selected_agency_name && <p className="text-base text-gray-700"><span className="font-semibold text-gray-900">Selected agency:</span> {req.selected_agency_name}</p>}
                    {req.internal_admin_note && <p className="text-base text-gray-700"><span className="font-semibold text-gray-900">Internal note:</span> {req.internal_admin_note}</p>}
                    {req.tl_event_details && <p className="text-base text-gray-700"><span className="font-semibold text-gray-900">TL event details:</span> {req.tl_event_details}</p>}
                    {req.published_listing_url && (
                      <a href={req.published_listing_url} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                        Open listing →
                      </a>
                    )}
                    <div className="pt-2">
                      <p className="text-sm font-semibold text-gray-900 mb-2">Notes</p>
                      {(updatesByRequest[req.id] || []).length > 0 ? (
                        <div className="space-y-2">
                          {(updatesByRequest[req.id] || []).map((u: any, idx: number) => (
                            <div key={`${u.id}-${idx}`} className="flex items-start gap-3">
                              <div className="min-w-0 w-full md:max-w-[50%] rounded-lg border border-gray-200 bg-white px-3 py-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs text-gray-500">{formatDateStable(u.created_at)}</p>
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${getUpdateAuthorMeta(u).className}`}>
                                      {getUpdateAuthorMeta(u).label}
                                    </span>
                                  </div>
                                  <p
                                    className="text-sm text-gray-700 mt-1 break-words"
                                    style={
                                      expandedNotes[u.id]
                                        ? undefined
                                        : {
                                            display: "-webkit-box",
                                            WebkitLineClamp: 3,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                          }
                                    }
                                  >
                                    {u.note}
                                  </p>
                                  {String(u.note || "").length > 180 && (
                                    <button
                                      type="button"
                                      onClick={() => toggleNote(u.id)}
                                      className="mt-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                                    >
                                      {expandedNotes[u.id] ? "Show less" : "Show more"}
                                    </button>
                                  )}
                              </div>
                              <Form method="post">
                                <input type="hidden" name="_action" value="deleteNote" />
                                <input type="hidden" name="requestId" value={req.id} />
                                <input type="hidden" name="noteId" value={u.id} />
                                <button
                                  type="submit"
                                  className="h-8 px-3 rounded-full border border-alert-200 text-alert-700 hover:bg-alert-50 text-xs font-semibold"
                                >
                                  Delete
                                </button>
                              </Form>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No notes yet.</p>
                      )}
                    </div>
                    <div className="grid md:grid-cols-2 gap-3 pt-2">
                      <Form method="post" className="space-y-2">
                        <input type="hidden" name="_action" value="setStatus" />
                        <input type="hidden" name="requestId" value={req.id} />
                        <label className="label">Change status</label>
                        <select name="nextStatus" defaultValue={req.status} className="input">
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          name="selectedAgencyName"
                          className="input"
                          placeholder="Selected agency (optional)"
                          defaultValue={req.selected_agency_name || ""}
                        />
                        <textarea
                          name="quoteSummary"
                          rows={2}
                          className="input w-full"
                          placeholder="Quote summary (optional)"
                          defaultValue={req.quote_summary || ""}
                        />
                        <textarea
                          name="internalAdminNote"
                          rows={2}
                          className="input w-full"
                          placeholder="Internal note (saved on request)"
                          defaultValue={req.internal_admin_note || ""}
                        />
                        <textarea name="note" rows={2} className="input w-full" placeholder="Add note (optional)" />
                        <button type="submit" className="btn-secondary rounded-full text-sm">Save Status</button>
                      </Form>

                      <Form method="post" className="space-y-2">
                        <input type="hidden" name="_action" value="publishAndNotify" />
                        <input type="hidden" name="requestId" value={req.id} />
                        <label className="label">Publish + notify all referrals</label>
                        <input
                          type="url"
                          name="listingUrl"
                          className="input"
                          placeholder="https://... listing URL"
                          defaultValue={req.published_listing_url || ""}
                          required
                        />
                        <textarea name="note" rows={2} className="input w-full" placeholder="Optional publish note" />
                        <button type="submit" className="btn-primary rounded-full text-sm">Publish & Notify</button>
                      </Form>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="p-6 text-sm text-gray-500">No event requests yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
