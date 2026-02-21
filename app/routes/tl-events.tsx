import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { useEffect } from "react";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { sendTemplatedEmail } from "~/lib/email/service.server";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { teamLeaderNavItems } from "~/components/panelNav";
import { useI18n } from "~/hooks/useI18n";

const STATUS_LABELS: Record<string, string> = {
  submitted: "tl_events.status.submitted",
  quoting: "tl_events.status.quoting",
  approved_for_event_draft: "tl_events.status.approved_for_event_draft",
  draft_submitted: "tl_events.status.draft_submitted",
  published: "tl_events.status.published",
};

export const meta: MetaFunction = () => [{ title: "Create Event - Team Leader - Runoot" }];

function formatDateStable(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!(user as any).is_team_leader) return redirect("/listings");

  const { data: requests } = await (supabaseAdmin.from("event_requests") as any)
    .select("*")
    .eq("team_leader_id", (user as any).id)
    .order("created_at", { ascending: false });

  return { user, requests: requests || [] };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  if (!(user as any).is_team_leader) return data({ errorKey: "only_team_leader" as const }, { status: 403 });

  const formData = await request.formData();
  const actionType = String(formData.get("_action") || "");

  if (actionType === "create") {
    const eventName = String(formData.get("eventName") || "").trim();
    const eventLocation = String(formData.get("eventLocation") || "").trim();
    const eventDate = String(formData.get("eventDate") || "").trim();
    const requestType = String(formData.get("requestType") || "").trim();
    const peopleCountRaw = Number(formData.get("peopleCount") || "0");
    const publicNote = String(formData.get("publicNote") || "").trim();
    const quotingNotes = String(formData.get("quotingNotes") || "").trim();
    const desiredDeadline = String(formData.get("desiredDeadline") || "").trim();

    if (!eventName || !eventLocation || !eventDate || !["bib", "hotel", "package"].includes(requestType) || peopleCountRaw <= 0) {
      return data({ errorKey: "fill_required" as const }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data: inserted, error } = await (supabaseAdmin.from("event_requests") as any)
      .insert({
        team_leader_id: (user as any).id,
        status: "submitted",
        event_name: eventName,
        event_location: eventLocation,
        event_date: eventDate,
        request_type: requestType,
        people_count: peopleCountRaw,
        public_note: publicNote || null,
        notes: quotingNotes || null,
        desired_deadline: desiredDeadline || null,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      return data({ error: `Could not create request: ${error?.message || "unknown error"}` }, { status: 500 });
    }

    await (supabaseAdmin.from("event_request_updates") as any).insert({
      event_request_id: inserted.id,
      actor_id: (user as any).id,
      actor_role: "team_leader",
      action: "created_submitted",
      note: quotingNotes || null,
    });

    const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
    const summaryLines = [
      `Event: ${eventName}`,
      `Location: ${eventLocation}`,
      `Date: ${formatDateStable(eventDate)}`,
      `Type: ${requestType}`,
      `People: ${peopleCountRaw}`,
      desiredDeadline ? `Desired deadline: ${formatDateStable(desiredDeadline)}` : null,
      publicNote ? `Public announcement note: ${publicNote}` : null,
      quotingNotes ? `Quoting notes: ${quotingNotes}` : null,
    ].filter(Boolean);

    const emailResult = await sendTemplatedEmail({
      to: (user as any).email,
      templateId: "platform_notification",
      locale: null,
      payload: {
        title: "Event request received",
        message: [
          "We received your new event request.",
          "",
          "Event summary:",
          ...summaryLines,
          "",
          "Our team is already working to get you the best quotations by requesting offers from our partner agencies.",
        ].join("\n"),
        ctaLabel: "Open Create Event",
        ctaUrl: `${appUrl}/tl-events`,
      },
    });

    if (!emailResult.ok) {
      return data({
        success: true,
        messageKey: "tl_events.success.submitted_email_failed" as const,
        refreshAfterPopup: true,
      });
    }

    return data({
      success: true,
      messageKey: "tl_events.success.submitted_email_sent" as const,
      refreshAfterPopup: true,
    });
  }

  if (actionType === "submitEventDraft") {
    const requestId = String(formData.get("requestId") || "");
    const eventDraftDetails = String(formData.get("eventDraftDetails") || "").trim();
    if (!requestId || !eventDraftDetails) {
      return data({ errorKey: "missing_request_or_details" as const }, { status: 400 });
    }

    const { data: existing } = await (supabaseAdmin.from("event_requests") as any)
      .select("id, status, team_leader_id")
      .eq("id", requestId)
      .eq("team_leader_id", (user as any).id)
      .maybeSingle();

    if (!existing) return data({ errorKey: "request_not_found" as const }, { status: 404 });
    if (existing.status !== "approved_for_event_draft") {
      return data({ errorKey: "request_not_ready" as const }, { status: 400 });
    }

    const now = new Date().toISOString();
    await (supabaseAdmin.from("event_requests") as any)
      .update({
        status: "draft_submitted",
        tl_event_details: eventDraftDetails,
        updated_at: now,
      })
      .eq("id", requestId);

    await (supabaseAdmin.from("event_request_updates") as any).insert({
      event_request_id: requestId,
      actor_id: (user as any).id,
      actor_role: "team_leader",
      action: "event_draft_submitted",
      note: eventDraftDetails,
    });

    return data({ success: true, messageKey: "tl_events.success.draft_submitted" as const });
  }

  return data({ errorKey: "unknown_action" as const }, { status: 400 });
}

export default function TLEventsPage() {
  const { t } = useI18n();
  const { user, requests } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as {
    error?: string;
    errorKey?: string;
    success?: boolean;
    message?: string;
    messageKey?: string;
    refreshAfterPopup?: boolean;
  } | undefined;
  const actionError =
    actionData?.errorKey ? t(`tl_events.error.${actionData.errorKey}` as any) : actionData?.error;
  const actionMessage =
    actionData?.messageKey ? t(actionData.messageKey as any) : actionData?.message;

  useEffect(() => {
    if (!actionData) return;

    if (actionError) {
      window.alert(actionError);
      return;
    }

    if (actionData.success && actionMessage) {
      window.alert(actionMessage);
      if (actionData.refreshAfterPopup) {
        window.location.reload();
      }
    }
  }, [actionData, actionError, actionMessage]);

  return (
    <ControlPanelLayout
      panelLabel={t("tl.panel_label")}
      mobileTitle={t("tl.mobile_title")}
      homeTo="/tl-dashboard"
      user={{
        fullName: (user as any).full_name,
        email: (user as any).email,
        roleLabel: t("tl.role_label"),
      }}
      navItems={teamLeaderNavItems}
    >
      <div className="min-h-full bg-gray-50">
      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-900">{t("tl_events.title")}</h1>
          <p className="text-gray-500">{t("tl_events.subtitle")}</p>
        </div>

        {actionError && (
          <div className="mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm">{actionError}</div>
        )}
        {actionData?.success && actionMessage && (
          <div className="mb-4 p-3 rounded-lg bg-success-50 text-success-700 text-sm">{actionMessage}</div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="font-display font-semibold text-gray-900 mb-4">{t("tl_events.new_request")}</h2>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="_action" value="create" />
            <div>
              <label className="label">{t("tl_events.event_name")} *</label>
              <input type="text" name="eventName" className="input" required />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="label">{t("tl_events.location")} *</label>
                <input type="text" name="eventLocation" className="input" required placeholder={t("tl_events.location_placeholder")} />
              </div>
              <div>
                <label className="label">{t("tl_events.event_date")} *</label>
                <input type="date" name="eventDate" className="input" required />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="label">{t("tl_events.request_type")} *</label>
                <select name="requestType" className="input" required defaultValue="package">
                  <option value="package">{t("tl_events.request_type.package")}</option>
                  <option value="hotel">{t("tl_events.request_type.hotel")}</option>
                  <option value="bib">{t("tl_events.request_type.bib")}</option>
                </select>
              </div>
              <div>
                <label className="label">{t("tl_events.people_count")} *</label>
                <input type="number" min={1} name="peopleCount" className="input" required defaultValue={1} />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="label">{t("tl_events.desired_deadline")}</label>
                <input type="date" name="desiredDeadline" className="input" />
              </div>
              <div />
            </div>
            <div>
              <label className="label">{t("tl_events.announcement_note")}</label>
              <textarea
                name="publicNote"
                rows={4}
                className="input w-full"
                placeholder={t("tl_events.announcement_note_placeholder")}
              />
            </div>
            <div>
              <label className="label">{t("tl_events.quoting_notes")}</label>
              <textarea
                name="quotingNotes"
                rows={4}
                className="input w-full"
                placeholder={t("tl_events.quoting_notes_placeholder")}
              />
            </div>
            <button type="submit" className="btn-primary rounded-full">{t("tl_events.submit_request")}</button>
          </Form>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-display font-semibold text-gray-900">{t("tl_events.your_requests")}</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {requests.length > 0 ? (
              requests.map((req: any) => (
                <div key={req.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{req.event_name}</p>
                      <p className="text-xs text-gray-500">{req.event_location} · {formatDateStable(req.event_date)}</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {t((STATUS_LABELS[req.status] || "tl_events.status.unknown") as any)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">
                    {t("tl_events.type")}: {req.request_type} · {t("tl_events.people")}: {req.people_count}
                    {req.desired_deadline ? ` · ${t("tl_events.deadline")}: ${formatDateStable(req.desired_deadline)}` : ""}
                  </p>
                  {req.public_note && (
                    <p className="text-xs text-gray-700 mb-1">
                      <span className="font-semibold text-gray-900">{t("tl_events.announcement_note_label")}:</span> {req.public_note}
                    </p>
                  )}
                  {req.notes && (
                    <p className="text-xs text-gray-700 mb-2">
                      <span className="font-semibold text-gray-900">{t("tl_events.quoting_notes_label")}:</span> {req.notes}
                    </p>
                  )}
                  {req.status === "approved_for_event_draft" && (
                    <Form method="post" className="mt-2 space-y-2">
                      <input type="hidden" name="_action" value="submitEventDraft" />
                      <input type="hidden" name="requestId" value={req.id} />
                      <label className="label">{t("tl_events.new_event_details")}</label>
                      <textarea
                        name="eventDraftDetails"
                        className="input w-full"
                        rows={3}
                        placeholder={t("tl_events.new_event_details_placeholder")}
                        required
                      />
                      <button type="submit" className="btn-secondary rounded-full text-sm">
                        {t("tl_events.submit_new_event")}
                      </button>
                    </Form>
                  )}
                  {req.published_listing_url && (
                    <a href={req.published_listing_url} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                      {t("tl_events.open_published_listing")}
                    </a>
                  )}
                </div>
              ))
            ) : (
              <div className="p-6 text-sm text-gray-500">{t("tl_events.none")}</div>
            )}
          </div>
        </div>
      </main>
    </div>
    </ControlPanelLayout>
  );
}
