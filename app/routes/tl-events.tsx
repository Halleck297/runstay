import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { useEffect, useState } from "react";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { sendTemplatedEmail } from "~/lib/email/service.server";
import { DatePicker } from "~/components/DatePicker";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { buildTeamLeaderNavItems } from "~/components/panelNav";
import { useI18n } from "~/hooks/useI18n";
import { normalizeEmailLocale } from "~/lib/email/types";
import { getTlEventNotificationSummary } from "~/lib/tl-event-notifications.server";

const STATUS_LABELS: Record<string, string> = {
  under_review: "tl_events.status.under_review",
  quoting: "tl_events.status.quoting",
  changes_requested: "tl_events.status.changes_requested",
  approved: "tl_events.status.approved",
  scheduled: "tl_events.status.scheduled",
  rejected: "tl_events.status.rejected",
  published: "tl_events.status.published",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  under_review: "bg-amber-100 text-amber-800 border-amber-200",
  quoting: "bg-sky-100 text-sky-800 border-sky-200",
  changes_requested: "bg-orange-100 text-orange-800 border-orange-200",
  approved: "bg-indigo-100 text-indigo-800 border-indigo-200",
  scheduled: "bg-cyan-100 text-cyan-800 border-cyan-200",
  published: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
};

const STATUS_LEGEND_ORDER = [
  "under_review",
  "quoting",
  "changes_requested",
  "approved",
  "scheduled",
  "rejected",
  "published",
] as const;

const EVENT_REQUEST_IMAGE_BUCKET = "event-request-media";
const MAX_EVENT_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_EVENT_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getImageExtension(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "bin";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uploadEventRequestImage(args: {
  file: File;
  requestId: string;
  teamLeaderId: string;
  eventName: string;
}): Promise<{ path: string; url: string } | { error: string }> {
  const { file, requestId, teamLeaderId, eventName } = args;
  if (!ALLOWED_EVENT_IMAGE_TYPES.has(file.type)) {
    return { error: "Invalid image format. Use JPG, PNG, or WEBP." };
  }
  if (file.size <= 0 || file.size > MAX_EVENT_IMAGE_BYTES) {
    return { error: "Image size must be between 1 byte and 8MB." };
  }

  const { data: bucket } = await supabaseAdmin.storage.getBucket(EVENT_REQUEST_IMAGE_BUCKET);
  if (!bucket) {
    await supabaseAdmin.storage.createBucket(EVENT_REQUEST_IMAGE_BUCKET, { public: true });
  }

  const ext = getImageExtension(file.type);
  const safeEventName = slugify(eventName || "event");
  const path = `${teamLeaderId}/${requestId}/${Date.now()}-${safeEventName}.${ext}`;
  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage
    .from(EVENT_REQUEST_IMAGE_BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      upsert: true,
      cacheControl: "3600",
    });

  if (uploadError) {
    return { error: `Image upload failed: ${uploadError.message}` };
  }

  const { data: publicData } = supabaseAdmin.storage.from(EVENT_REQUEST_IMAGE_BUCKET).getPublicUrl(path);
  return { path, url: publicData.publicUrl };
}

export const meta: MetaFunction = () => [{ title: "Create Event - Team Leader - Runoot" }];

function formatDateStable(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function splitEventLocation(raw: string | null | undefined) {
  const value = String(raw || "").trim();
  if (!value) return { location: "", country: "" };
  const parts = value.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return { location: value, country: "" };
  return { location: parts.slice(0, -1).join(", "), country: parts[parts.length - 1] };
}

function getShowcaseQuotes(quotes: any[]) {
  const all = [...(quotes || [])].sort((a: any, b: any) => Number(a.total_price || 0) - Number(b.total_price || 0));
  const recommended = all.filter((q: any) => q.is_recommended);
  const base = (recommended.length > 0 ? recommended : all).slice(0, 3);
  return base;
}

function getQuoteTierLabel(index: number, total: number) {
  if (total <= 1) return "Best option";
  if (index === 0) return "Budget";
  if (index === total - 1) return "Premium";
  return "Balanced";
}

function RequestTypeDropdown({
  name,
  value,
  onChange,
  placeholder,
}: {
  name: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const options = [
    { value: "package", label: t("tl_events.request_type.package") },
    { value: "hotel", label: t("tl_events.request_type.hotel") },
    { value: "bib", label: t("tl_events.request_type.bib") },
  ];
  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`input w-full flex items-center justify-between gap-3 text-left ${value ? "text-gray-900" : "text-gray-400"}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{selected?.label || placeholder}</span>
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-100 bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                value === option.value ? "bg-brand-50 font-medium text-brand-700" : "text-gray-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getTlEventRequestEmailCopy(localeInput: string | null | undefined) {
  const locale = normalizeEmailLocale(localeInput);
  const copy = {
    en: {
      title: "Event request received",
      intro: "We received your new event request.",
      summary: "Event summary:",
      event: "Event",
      location: "Location",
      date: "Date",
      type: "Type",
      people: "People",
      deadline: "Desired deadline",
      publicNote: "Public announcement note",
      quotingNotes: "Quoting notes",
      outro: "Our team is already working to get you the best quotations by requesting offers from our partner agencies.",
      cta: "Open Create Event",
    },
    it: {
      title: "Richiesta evento ricevuta",
      intro: "Abbiamo ricevuto la tua nuova richiesta evento.",
      summary: "Riepilogo evento:",
      event: "Evento",
      location: "Localita",
      date: "Data",
      type: "Tipo",
      people: "Persone",
      deadline: "Scadenza desiderata",
      publicNote: "Nota annuncio pubblico",
      quotingNotes: "Note per i preventivi",
      outro: "Il nostro team sta gia lavorando per ottenere i migliori preventivi richiedendo offerte alle agenzie partner.",
      cta: "Apri Crea Evento",
    },
    de: {
      title: "Event-Anfrage erhalten",
      intro: "Wir haben deine neue Event-Anfrage erhalten.",
      summary: "Event-Zusammenfassung:",
      event: "Event",
      location: "Ort",
      date: "Datum",
      type: "Typ",
      people: "Personen",
      deadline: "Gewuenschte Frist",
      publicNote: "Hinweis fuer oeffentliche Ankuendigung",
      quotingNotes: "Notizen fuer Angebote",
      outro: "Unser Team arbeitet bereits daran, die besten Angebote von unseren Partneragenturen einzuholen.",
      cta: "Event erstellen oeffnen",
    },
    fr: {
      title: "Demande d'evenement recue",
      intro: "Nous avons recu votre nouvelle demande d'evenement.",
      summary: "Resume de l'evenement :",
      event: "Evenement",
      location: "Lieu",
      date: "Date",
      type: "Type",
      people: "Personnes",
      deadline: "Echeance souhaitee",
      publicNote: "Note d'annonce publique",
      quotingNotes: "Notes pour les devis",
      outro: "Notre equipe travaille deja pour obtenir les meilleures offres de nos agences partenaires.",
      cta: "Ouvrir Creer un evenement",
    },
    es: {
      title: "Solicitud de evento recibida",
      intro: "Hemos recibido tu nueva solicitud de evento.",
      summary: "Resumen del evento:",
      event: "Evento",
      location: "Ubicacion",
      date: "Fecha",
      type: "Tipo",
      people: "Personas",
      deadline: "Fecha limite deseada",
      publicNote: "Nota del anuncio publico",
      quotingNotes: "Notas para cotizacion",
      outro: "Nuestro equipo ya esta trabajando para conseguir las mejores cotizaciones solicitando ofertas a nuestras agencias asociadas.",
      cta: "Abrir Crear Evento",
    },
    nl: {
      title: "Evenementaanvraag ontvangen",
      intro: "We hebben je nieuwe evenementaanvraag ontvangen.",
      summary: "Samenvatting van het evenement:",
      event: "Evenement",
      location: "Locatie",
      date: "Datum",
      type: "Type",
      people: "Personen",
      deadline: "Gewenste deadline",
      publicNote: "Openbare aankondigingsnotitie",
      quotingNotes: "Offertenotities",
      outro: "Ons team werkt al aan de beste offertes door aanbiedingen op te vragen bij onze partnerbureaus.",
      cta: "Open Evenement Aanmaken",
    },
    pt: {
      title: "Solicitacao de evento recebida",
      intro: "Recebemos sua nova solicitacao de evento.",
      summary: "Resumo do evento:",
      event: "Evento",
      location: "Local",
      date: "Data",
      type: "Tipo",
      people: "Pessoas",
      deadline: "Prazo desejado",
      publicNote: "Nota de anuncio publico",
      quotingNotes: "Notas para cotacao",
      outro: "Nossa equipe ja esta trabalhando para conseguir as melhores cotacoes solicitando ofertas das agencias parceiras.",
      cta: "Abrir Criar Evento",
    },
  } as const;

  return copy[locale];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!(user as any).is_team_leader) return redirect("/listings");

  const { data: requests } = await (supabaseAdmin.from("event_requests") as any)
    .select("*")
    .eq("team_leader_id", (user as any).id)
    .order("created_at", { ascending: false });

  const requestIds = (requests || []).map((r: any) => r.id);
  let updatesByRequest: Record<string, any[]> = {};
  let quotesByRequest: Record<string, any[]> = {};
  const unreadByRequest: Record<string, boolean> = {};
  const statusUnreadByRequest: Record<string, boolean> = {};
  const eventNotificationSummary = await getTlEventNotificationSummary((user as any).id);

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

    const { data: quotes } = await (supabaseAdmin.from("event_request_quotes") as any)
      .select("*")
      .in("event_request_id", requestIds)
      .order("is_recommended", { ascending: false })
      .order("total_price", { ascending: true })
      .order("created_at", { ascending: false });

    quotesByRequest = (quotes || []).reduce((acc: Record<string, any[]>, row: any) => {
      if (!acc[row.event_request_id]) acc[row.event_request_id] = [];
      acc[row.event_request_id].push(row);
      return acc;
    }, {});

    for (const req of requests || []) {
      unreadByRequest[req.id] = (eventNotificationSummary.messageUnreadByRequest[req.id] || 0) > 0;
      statusUnreadByRequest[req.id] = (eventNotificationSummary.statusUnreadByRequest[req.id] || 0) > 0;
    }
  }

  return {
    user,
    requests: requests || [],
    updatesByRequest,
    quotesByRequest,
    unreadByRequest,
    statusUnreadByRequest,
    eventUnreadCount: eventNotificationSummary.totalUnread,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  if (!(user as any).is_team_leader) return data({ errorKey: "only_team_leader" as const }, { status: 403 });

  const formData = await request.formData();
  const actionType = String(formData.get("_action") || "");

  if (actionType === "create") {
    const eventName = String(formData.get("eventName") || "").trim();
    const eventLocation = String(formData.get("eventLocation") || "").trim();
    const eventCountry = String(formData.get("eventCountry") || "").trim();
    const eventDate = String(formData.get("eventDate") || "").trim();
    const requestType = String(formData.get("requestType") || "").trim();
    const peopleCountRaw = Number(formData.get("peopleCount") || "0");
    const publicNote = String(formData.get("publicNote") || "").trim();
    const quotingNotes = String(formData.get("quotingNotes") || "").trim();
    const desiredDeadline = String(formData.get("desiredDeadline") || "").trim();
    const eventImage = formData.get("eventImage");

    if (!eventName || !eventLocation || !eventCountry || !eventDate || !["bib", "hotel", "package"].includes(requestType) || peopleCountRaw <= 0) {
      return data({ errorKey: "fill_required" as const }, { status: 400 });
    }
    const eventLocationCombined = `${eventLocation}, ${eventCountry}`;

    const now = new Date().toISOString();
    const requestId = crypto.randomUUID();
    const { data: inserted, error } = await (supabaseAdmin.from("event_requests") as any)
      .insert({
        id: requestId,
        team_leader_id: (user as any).id,
        status: "under_review",
        event_name: eventName,
        event_location: eventLocationCombined,
        event_date: eventDate,
        request_type: requestType,
        people_count: peopleCountRaw,
        public_note: publicNote || null,
        notes: quotingNotes || null,
        desired_deadline: desiredDeadline || null,
        tl_last_seen_update_at: now,
        admin_last_seen_update_at: now,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      return data({ error: `Could not create request: ${error?.message || "unknown error"}` }, { status: 500 });
    }

    let imageUploadWarning: string | null = null;
    if (eventImage instanceof File && eventImage.size > 0) {
      const uploaded = await uploadEventRequestImage({
        file: eventImage,
        requestId: inserted.id,
        teamLeaderId: (user as any).id,
        eventName,
      });

      if ("error" in uploaded) {
        imageUploadWarning = uploaded.error;
      } else {
        await (supabaseAdmin.from("event_requests") as any)
          .update({
            event_image_url: uploaded.url,
            event_image_path: uploaded.path,
            updated_at: new Date().toISOString(),
          })
          .eq("id", inserted.id);
      }
    }

    await (supabaseAdmin.from("event_request_updates") as any).insert({
      event_request_id: inserted.id,
      actor_id: (user as any).id,
      actor_role: "team_leader",
      action: "created_under_review",
      note: quotingNotes || null,
    });

    const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
    const emailCopy = getTlEventRequestEmailCopy((user as any).preferred_language);
    const summaryLines = [
      `${emailCopy.event}: ${eventName}`,
      `${emailCopy.location}: ${eventLocationCombined}`,
      `${emailCopy.date}: ${formatDateStable(eventDate)}`,
      `${emailCopy.type}: ${requestType}`,
      `${emailCopy.people}: ${peopleCountRaw}`,
      desiredDeadline ? `${emailCopy.deadline}: ${formatDateStable(desiredDeadline)}` : null,
      publicNote ? `${emailCopy.publicNote}: ${publicNote}` : null,
      quotingNotes ? `${emailCopy.quotingNotes}: ${quotingNotes}` : null,
    ].filter(Boolean);

    const emailResult = await sendTemplatedEmail({
      to: (user as any).email,
      templateId: "platform_notification",
      locale: (user as any).preferred_language || null,
      payload: {
        title: emailCopy.title,
        message: [
          emailCopy.intro,
          "",
          emailCopy.summary,
          ...summaryLines,
          "",
          emailCopy.outro,
        ].join("\n"),
        ctaLabel: emailCopy.cta,
        ctaUrl: `${appUrl}/tl-events`,
      },
    });

    if (!emailResult.ok) {
      const baseMessage = "Event request submitted. Confirmation email could not be sent right now.";
      return data({
        success: true,
        message: imageUploadWarning ? `${baseMessage} ${imageUploadWarning}` : baseMessage,
        refreshAfterPopup: true,
      });
    }

    const successMessage = "Event request submitted. Confirmation email sent.";
    return data({
      success: true,
      message: imageUploadWarning ? `${successMessage} ${imageUploadWarning}` : successMessage,
      refreshAfterPopup: true,
    });
  }

  if (actionType === "markSeen") {
    const requestId = String(formData.get("requestId") || "");
    if (!requestId) return data({ errorKey: "request_not_found" as const }, { status: 404 });

    const { data: existing } = await (supabaseAdmin.from("event_requests") as any)
      .select("id, team_leader_id")
      .eq("id", requestId)
      .eq("team_leader_id", (user as any).id)
      .maybeSingle();

    if (!existing) return data({ errorKey: "request_not_found" as const }, { status: 404 });

    await (supabaseAdmin.from("event_requests") as any)
      .update({
        tl_last_seen_update_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    const { data: unreadNotifs } = await (supabaseAdmin.from("notifications") as any)
      .select("id, data")
      .eq("user_id", (user as any).id)
      .is("read_at", null);

    const idsToMark = (unreadNotifs || [])
      .filter((n: any) => {
        const payload = (n?.data || {}) as Record<string, any>;
        const kind = String(payload.kind || "");
        const eventRequestId = String(payload.event_request_id || "");
        return (
          eventRequestId === requestId &&
          (kind === "tl_event_status_update" || kind === "tl_event_message")
        );
      })
      .map((n: any) => n.id);

    if (idsToMark.length > 0) {
      await (supabaseAdmin.from("notifications") as any)
        .update({ read_at: new Date().toISOString() })
        .in("id", idsToMark)
        .eq("user_id", (user as any).id);
    }

    return data({ success: true, refreshAfterPopup: true });
  }

  if (actionType === "updateRequest") {
    const requestId = String(formData.get("requestId") || "");
    const eventName = String(formData.get("eventName") || "").trim();
    const eventLocation = String(formData.get("eventLocation") || "").trim();
    const eventCountry = String(formData.get("eventCountry") || "").trim();
    const eventDate = String(formData.get("eventDate") || "").trim();
    const requestType = String(formData.get("requestType") || "").trim();
    const peopleCountRaw = Number(formData.get("peopleCount") || "0");
    const publicNote = String(formData.get("publicNote") || "").trim();
    const quotingNotes = String(formData.get("quotingNotes") || "").trim();
    const desiredDeadline = String(formData.get("desiredDeadline") || "").trim();
    const eventImage = formData.get("eventImage");

    if (!requestId || !eventName || !eventLocation || !eventCountry || !eventDate || !["bib", "hotel", "package"].includes(requestType) || peopleCountRaw <= 0) {
      return data({ errorKey: "fill_required" as const }, { status: 400 });
    }
    const eventLocationCombined = `${eventLocation}, ${eventCountry}`;

    const { data: existing } = await (supabaseAdmin.from("event_requests") as any)
      .select("id, status, team_leader_id, event_image_path")
      .eq("id", requestId)
      .eq("team_leader_id", (user as any).id)
      .maybeSingle();

    if (!existing) return data({ errorKey: "request_not_found" as const }, { status: 404 });
    if (existing.status !== "changes_requested") {
      return data({ errorKey: "request_not_ready" as const }, { status: 400 });
    }

    const now = new Date().toISOString();
    await (supabaseAdmin.from("event_requests") as any)
      .update({
        status: "under_review",
        event_name: eventName,
        event_location: eventLocationCombined,
        event_date: eventDate,
        request_type: requestType,
        people_count: peopleCountRaw,
        public_note: publicNote || null,
        notes: quotingNotes || null,
        desired_deadline: desiredDeadline || null,
        tl_last_seen_update_at: now,
        updated_at: now,
      })
      .eq("id", requestId);

    if (eventImage instanceof File && eventImage.size > 0) {
      const uploaded = await uploadEventRequestImage({
        file: eventImage,
        requestId,
        teamLeaderId: (user as any).id,
        eventName,
      });
      if ("error" in uploaded) {
        return data({ error: uploaded.error }, { status: 400 });
      }

      await (supabaseAdmin.from("event_requests") as any)
        .update({
          event_image_url: uploaded.url,
          event_image_path: uploaded.path,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if ((existing as any).event_image_path) {
        await supabaseAdmin.storage
          .from(EVENT_REQUEST_IMAGE_BUCKET)
          .remove([(existing as any).event_image_path]);
      }
    }

    await (supabaseAdmin.from("event_request_updates") as any).insert({
      event_request_id: requestId,
      actor_id: (user as any).id,
      actor_role: "team_leader",
      action: "resubmitted_after_changes",
      note: quotingNotes || null,
    });

    return data({
      success: true,
      messageKey: "tl_events.success.resubmitted" as const,
      refreshAfterPopup: true,
    });
  }

  if (actionType === "replyToAdmin") {
    const requestId = String(formData.get("requestId") || "");
    const tlMessage = String(formData.get("tlMessage") || "").trim();

    if (!requestId || !tlMessage) {
      return data({ errorKey: "fill_required" as const }, { status: 400 });
    }

    const { data: existing } = await (supabaseAdmin.from("event_requests") as any)
      .select("id, team_leader_id")
      .eq("id", requestId)
      .eq("team_leader_id", (user as any).id)
      .maybeSingle();

    if (!existing) return data({ errorKey: "request_not_found" as const }, { status: 404 });

    await (supabaseAdmin.from("event_request_updates") as any).insert({
      event_request_id: requestId,
      actor_id: (user as any).id,
      actor_role: "team_leader",
      action: "direct_message_to_admin",
      note: tlMessage,
    });

    await (supabaseAdmin.from("event_requests") as any)
      .update({
        tl_last_seen_update_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    return data({
      success: true,
      message: "Message sent to admin.",
      refreshAfterPopup: true,
    });
  }

  if (actionType === "chooseQuote") {
    const requestId = String(formData.get("requestId") || "");
    const quoteId = String(formData.get("quoteId") || "");
    if (!requestId || !quoteId) {
      return data({ errorKey: "request_not_found" as const }, { status: 404 });
    }

    const { data: existing } = await (supabaseAdmin.from("event_requests") as any)
      .select("id, team_leader_id, status, event_name")
      .eq("id", requestId)
      .eq("team_leader_id", (user as any).id)
      .maybeSingle();
    if (!existing) return data({ errorKey: "request_not_found" as const }, { status: 404 });
    if (existing.status !== "quoting") {
      return data({ error: "Quote selection is available only in quoting status." }, { status: 400 });
    }

    const { data: quote } = await (supabaseAdmin.from("event_request_quotes") as any)
      .select("*")
      .eq("id", quoteId)
      .eq("event_request_id", requestId)
      .maybeSingle();
    if (!quote) return data({ error: "Quote option not found." }, { status: 404 });

    await (supabaseAdmin.from("event_request_quotes") as any)
      .update({ is_selected: false, updated_at: new Date().toISOString() })
      .eq("event_request_id", requestId);

    await (supabaseAdmin.from("event_request_quotes") as any)
      .update({ is_selected: true, updated_at: new Date().toISOString() })
      .eq("id", quoteId);

    await (supabaseAdmin.from("event_requests") as any)
      .update({
        status: "approved",
        selected_quote_id: quoteId,
        selected_agency_name: quote.agency_name || null,
        quote_summary: quote.summary || null,
        selected_quote_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    await (supabaseAdmin.from("event_request_updates") as any).insert({
      event_request_id: requestId,
      actor_id: (user as any).id,
      actor_role: "team_leader",
      action: "quote_selected",
      note: `Selected quote from ${quote.agency_name} (${quote.currency} ${quote.total_price})`,
    });

    const { data: adminProfiles } = await (supabaseAdmin.from("profiles") as any)
      .select("id")
      .in("role", ["admin", "superadmin"]);

    const adminNotificationRows = (adminProfiles || []).map((profile: any) => ({
      user_id: profile.id,
      type: "system",
      title: "TL selected a quote",
      message: `${existing.event_name}: ${quote.agency_name} (${quote.currency} ${quote.total_price})`,
      data: {
        kind: "tl_quote_selected",
        event_request_id: requestId,
        quote_id: quoteId,
      },
    }));

    if (adminNotificationRows.length > 0) {
      await (supabaseAdmin.from("notifications") as any).insert(adminNotificationRows);
    }

    return data({
      success: true,
      message: "Quote selected successfully.",
      refreshAfterPopup: true,
    });
  }

  return data({ errorKey: "unknown_action" as const }, { status: 400 });
}

export default function TLEventsPage() {
  const { t } = useI18n();
  const { user, requests, updatesByRequest, quotesByRequest, unreadByRequest, statusUnreadByRequest, eventUnreadCount } = useLoaderData<typeof loader>();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [createRequestType, setCreateRequestType] = useState("package");
  const [editRequestTypeById, setEditRequestTypeById] = useState<Record<string, string>>({});
  const [openConversationByRequest, setOpenConversationByRequest] = useState<Record<string, boolean>>({});
  const [popupState, setPopupState] = useState<{
    open: boolean;
    type: "success" | "error";
    message: string;
    refreshOnClose: boolean;
  }>({
    open: false,
    type: "success",
    message: "",
    refreshOnClose: false,
  });
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
      setPopupState({
        open: true,
        type: "error",
        message: actionError,
        refreshOnClose: false,
      });
      return;
    }

    if (actionData.success && actionMessage) {
      setPopupState({
        open: true,
        type: "success",
        message: actionMessage,
        refreshOnClose: !!actionData.refreshAfterPopup,
      });
    }
  }, [actionData, actionError, actionMessage]);

  useEffect(() => {
    setOpenConversationByRequest((prev) => {
      const next: Record<string, boolean> = {};
      for (const req of requests || []) {
        if (unreadByRequest?.[req.id]) {
          // Keep conversation open while there is an unread admin message.
          next[req.id] = true;
        } else if (Object.prototype.hasOwnProperty.call(prev, req.id)) {
          next[req.id] = !!prev[req.id];
        } else {
          next[req.id] = false;
        }
      }
      return next;
    });
  }, [requests, unreadByRequest]);

  function closePopup() {
    const shouldRefresh = popupState.refreshOnClose;
    setPopupState((prev) => ({ ...prev, open: false, refreshOnClose: false }));
    if (shouldRefresh) {
      window.location.reload();
    }
  }

  return (
    <ControlPanelLayout
      panelLabel={t("tl.panel_label")}
      mobileTitle={t("tl.mobile_title")}
      homeTo="/tl-dashboard"
      user={{
        fullName: (user as any).full_name,
        email: (user as any).email,
        roleLabel: t("tl.role_label"),
        avatarUrl: (user as any).avatar_url,
      }}
      navItems={buildTeamLeaderNavItems(eventUnreadCount || 0)}
    >
      {popupState.open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.28)]">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 h-2.5 w-2.5 rounded-full ${popupState.type === "success" ? "bg-emerald-500" : "bg-red-500"}`} />
              <div className="min-w-0">
                <h3 className="font-display text-lg font-semibold text-gray-900">
                  {popupState.type === "success" ? "Success" : "Error"}
                </h3>
                <p className="mt-1 text-sm text-gray-700">{popupState.message}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={closePopup} className="btn-primary rounded-full px-5 text-sm">
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="min-h-full">
      <main className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 md:py-8 md:pb-8 lg:px-8">
        <div className="mb-6 rounded-3xl border border-brand-200/70 bg-gradient-to-r from-brand-50 via-white to-orange-50 p-6 shadow-sm">
          <h1 className="font-display text-2xl font-bold text-gray-900">{t("tl_events.title")}</h1>
          <p className="mt-1 text-gray-600">{t("tl_events.subtitle")}</p>
        </div>

        {actionError && (
          <div className="mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm">{actionError}</div>
        )}
        {actionData?.success && actionMessage && (
          <div className="mb-4 p-3 rounded-lg bg-success-50 text-success-700 text-sm">{actionMessage}</div>
        )}

        <div className="mb-6 rounded-3xl border border-brand-200/70 bg-white/95 shadow-[0_10px_28px_rgba(249,115,22,0.10)] transition-colors hover:border-brand-300">
          <button
            type="button"
            onClick={() => setIsCreateOpen((prev) => !prev)}
            className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
            aria-expanded={isCreateOpen}
            aria-controls="create-event-request-panel"
          >
            <h2 className="font-display font-semibold text-gray-900">{t("tl_events.new_request")}</h2>
            <svg
              className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${isCreateOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isCreateOpen && (
            <div id="create-event-request-panel" className="border-t border-brand-100 px-6 pb-6 pt-4">
              <Form method="post" encType="multipart/form-data" className="space-y-4">
                <input type="hidden" name="_action" value="create" />
                <div className="md:max-w-md">
                  <label className="label">{t("tl_events.event_name")} *</label>
                  <input type="text" name="eventName" className="input" placeholder={t("tl_events.event_name_placeholder")} required />
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <label className="label">{t("tl_events.location")} *</label>
                    <input type="text" name="eventLocation" className="input" required placeholder={t("tl_events.location_placeholder")} />
                  </div>
                  <div>
                    <label className="label">{t("tl_events.country")} *</label>
                    <input type="text" name="eventCountry" className="input" required placeholder={t("tl_events.country_placeholder")} />
                  </div>
                  <div>
                    <label className="label">{t("tl_events.event_date")} *</label>
                    <DatePicker id="tl-event-date" name="eventDate" placeholder={t("tl_events.date_placeholder_short")} />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="md:max-w-xs">
                    <label className="label">{t("tl_events.request_type")} *</label>
                    <RequestTypeDropdown
                      name="requestType"
                      value={createRequestType}
                      onChange={setCreateRequestType}
                      placeholder={t("tl_events.request_type_placeholder")}
                    />
                  </div>
                  <div className="md:max-w-[140px]">
                    <label className="label">{t("tl_events.people_count")} *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      name="peopleCount"
                      className="input"
                      required
                      defaultValue={1}
                      placeholder={t("tl_events.people_count_placeholder")}
                      onInput={(e) => {
                        e.currentTarget.value = e.currentTarget.value.replace(/\D+/g, "");
                      }}
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="label">{t("tl_events.desired_deadline")}</label>
                    <DatePicker id="tl-deadline-date" name="desiredDeadline" placeholder={t("tl_events.date_placeholder_short")} />
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
                <div>
                  <label className="label">{t("tl_events.event_photo")}</label>
                  <input type="file" name="eventImage" accept="image/jpeg,image/png,image/webp" className="input pt-2" />
                  <p className="mt-1 text-xs text-gray-500">{t("tl_events.event_photo_help")}</p>
                </div>
                <button type="submit" className="btn-primary rounded-full">{t("tl_events.submit_request")}</button>
              </Form>
            </div>
          )}
        </div>

        <div className="mb-6 flex items-center gap-3 px-1">
          <div className="h-px flex-1 bg-gray-300" />
          <span className="rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            {t("tl_events.your_requests")}
          </span>
          <div className="h-px flex-1 bg-gray-300" />
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-300 bg-slate-50/70 shadow-sm transition-colors hover:border-slate-400">
          <div className="border-b border-slate-200 bg-white/90 px-6 py-4">
            <h2 className="font-display font-semibold text-gray-900">{t("tl_events.your_requests")}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUS_LEGEND_ORDER.map((status) => (
                <span
                  key={status}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    STATUS_BADGE_CLASSES[status] || "bg-gray-100 text-gray-700 border-gray-200"
                  }`}
                >
                  {t((STATUS_LABELS[status] || "tl_events.status.unknown") as any)}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-3 p-3">
            {requests.length > 0 ? (
              requests.map((req: any) => (
                <div key={req.id} className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{req.event_name}</p>
                      <p className="text-xs text-gray-500">{req.event_location} · {formatDateStable(req.event_date)}</p>
                    </div>
                    {unreadByRequest?.[req.id] && (
                      <span className="rounded-full border border-brand-200 bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-800">
                        {t("tl_events.new_message")}
                      </span>
                    )}
                    {statusUnreadByRequest?.[req.id] && (
                      <span className="rounded-full border border-indigo-200 bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                        {t("tl_events.status_update")}
                      </span>
                    )}
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        STATUS_BADGE_CLASSES[req.status] || "bg-gray-100 text-gray-700 border-gray-200"
                      }`}
                    >
                      {t((STATUS_LABELS[req.status] || "tl_events.status.unknown") as any)}
                    </span>
                  </div>
                  {req.event_image_url && (
                    <div className="mb-2 flex justify-end">
                      <img
                        src={req.event_image_url}
                        alt={req.event_name}
                        className="h-20 w-32 rounded-lg border border-gray-200 object-cover shadow-sm sm:h-24 sm:w-40"
                        loading="lazy"
                      />
                    </div>
                  )}
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
                  {(quotesByRequest?.[req.id] || []).length > 0 && (
                    <div className="mt-3 rounded-xl border border-gray-200 bg-white/90 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Top quote options</p>
                      <div className="mt-2 space-y-2">
                        {getShowcaseQuotes(quotesByRequest?.[req.id] || []).map((quote: any, idx: number, arr: any[]) => (
                          <div key={quote.id} className="rounded-lg border border-gray-200 bg-white p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-900">
                                {quote.agency_name}
                                {quote.package_title ? ` · ${quote.package_title}` : ""}
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                                  {getQuoteTierLabel(idx, arr.length)}
                                </span>
                                {quote.is_selected && (
                                  <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                    Selected
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="mt-1 text-sm text-gray-700">
                              {quote.currency} {quote.total_price}
                              {quote.valid_until ? ` · valid until ${formatDateStable(quote.valid_until)}` : ""}
                            </p>
                            {quote.summary && <p className="mt-1 text-xs text-gray-700">{quote.summary}</p>}
                            {quote.attachment_url && (
                              <a
                                href={quote.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-block text-xs font-semibold text-brand-700 hover:text-brand-800"
                              >
                                Download quote file
                              </a>
                            )}
                            {req.status === "quoting" && !quote.is_selected && (
                              <Form method="post" className="mt-2">
                                <input type="hidden" name="_action" value="chooseQuote" />
                                <input type="hidden" name="requestId" value={req.id} />
                                <input type="hidden" name="quoteId" value={quote.id} />
                                <button type="submit" className="btn-secondary rounded-full text-xs">
                                  Choose this quote
                                </button>
                              </Form>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Conversation</p>
                      {!unreadByRequest?.[req.id] && (
                        <button
                          type="button"
                          onClick={() =>
                            setOpenConversationByRequest((prev) => ({
                              ...prev,
                              [req.id]: !prev[req.id],
                            }))
                          }
                          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          {openConversationByRequest?.[req.id] ? "Collapse" : "Open"}
                        </button>
                      )}
                    </div>
                    {(unreadByRequest?.[req.id] || statusUnreadByRequest?.[req.id]) && (
                      <Form method="post" className="mt-2">
                        <input type="hidden" name="_action" value="markSeen" />
                        <input type="hidden" name="requestId" value={req.id} />
                        <button type="submit" className="rounded-full border border-brand-300 bg-white px-3 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50">
                          {t("tl_events.mark_as_read")}
                        </button>
                      </Form>
                    )}
                    {(unreadByRequest?.[req.id] || openConversationByRequest?.[req.id]) && (
                      <>
                        <div className="mt-2 space-y-2">
                          {(updatesByRequest?.[req.id] || []).filter((u: any) => String(u.note || "").trim().length > 0).slice(0, 8).map((u: any) => {
                            const isAdmin = u.actor_role === "superadmin";
                            return (
                              <div key={u.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isAdmin ? "bg-brand-100 text-brand-700" : "bg-indigo-100 text-indigo-700"}`}>
                                    {isAdmin ? "Admin" : "TL"}
                                  </span>
                                  <span className="text-[11px] text-gray-500">{formatDateStable(u.created_at)}</span>
                                </div>
                                <p className="mt-1 text-xs text-gray-700 whitespace-pre-wrap">{u.note}</p>
                              </div>
                            );
                          })}
                          {(updatesByRequest?.[req.id] || []).filter((u: any) => String(u.note || "").trim().length > 0).length === 0 && (
                            <p className="text-xs text-gray-500">No messages yet.</p>
                          )}
                        </div>

                        <Form method="post" className="mt-3 space-y-2">
                          <input type="hidden" name="_action" value="replyToAdmin" />
                          <input type="hidden" name="requestId" value={req.id} />
                          <textarea
                            name="tlMessage"
                            rows={2}
                            className="input w-full"
                            placeholder="Write a message to admin..."
                            required
                          />
                          <button type="submit" className="btn-secondary rounded-full text-xs">
                            Send to admin
                          </button>
                        </Form>
                      </>
                    )}
                  </div>
                  {req.status === "changes_requested" && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setEditingRequestId((prev) => (prev === req.id ? null : req.id))}
                        className="btn-secondary rounded-full text-sm"
                      >
                        {t("tl_events.edit_request")}
                      </button>
                    </div>
                  )}
                  {req.status === "changes_requested" && editingRequestId === req.id && (
                    <Form method="post" encType="multipart/form-data" className="mt-3 space-y-4 rounded-xl border border-orange-200 bg-orange-50/50 p-4">
                      <input type="hidden" name="_action" value="updateRequest" />
                      <input type="hidden" name="requestId" value={req.id} />
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-orange-900">{t("tl_events.edit_request")}</p>
                        <span className="rounded-full border border-orange-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                          {t("tl_events.status.changes_requested")}
                        </span>
                      </div>
                      <div className="md:max-w-md">
                        <label className="label">{t("tl_events.event_name")} *</label>
                        <input type="text" name="eventName" className="input" required defaultValue={req.event_name} placeholder={t("tl_events.event_name_placeholder")} />
                      </div>
                      <div className="grid md:grid-cols-3 gap-3">
                        <div>
                          <label className="label">{t("tl_events.location")} *</label>
                          <input
                            type="text"
                            name="eventLocation"
                            className="input"
                            required
                            defaultValue={splitEventLocation(req.event_location).location}
                            placeholder={t("tl_events.location_placeholder")}
                          />
                        </div>
                        <div>
                          <label className="label">{t("tl_events.country")} *</label>
                          <input
                            type="text"
                            name="eventCountry"
                            className="input"
                            required
                            defaultValue={splitEventLocation(req.event_location).country}
                            placeholder={t("tl_events.country_placeholder")}
                          />
                        </div>
                        <div>
                          <label className="label">{t("tl_events.event_date")} *</label>
                          <DatePicker
                            id={`tl-edit-event-date-${req.id}`}
                            name="eventDate"
                            defaultValue={req.event_date}
                            placeholder={t("tl_events.date_placeholder_short")}
                          />
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="md:max-w-xs">
                          <label className="label">{t("tl_events.request_type")} *</label>
                          <RequestTypeDropdown
                            name="requestType"
                            value={editRequestTypeById[req.id] || req.request_type}
                            onChange={(next) => setEditRequestTypeById((prev) => ({ ...prev, [req.id]: next }))}
                            placeholder={t("tl_events.request_type_placeholder")}
                          />
                        </div>
                        <div className="md:max-w-[140px]">
                          <label className="label">{t("tl_events.people_count")} *</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            name="peopleCount"
                            className="input"
                            required
                            defaultValue={req.people_count}
                            placeholder={t("tl_events.people_count_placeholder")}
                            onInput={(e) => {
                              e.currentTarget.value = e.currentTarget.value.replace(/\D+/g, "");
                            }}
                          />
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <label className="label">{t("tl_events.desired_deadline")}</label>
                          <DatePicker
                            id={`tl-edit-deadline-date-${req.id}`}
                            name="desiredDeadline"
                            defaultValue={req.desired_deadline || ""}
                            placeholder={t("tl_events.date_placeholder_short")}
                          />
                        </div>
                        <div />
                      </div>
                      <div>
                        <label className="label">{t("tl_events.announcement_note")}</label>
                        <textarea
                          name="publicNote"
                          rows={3}
                          className="input w-full"
                          placeholder={t("tl_events.announcement_note_placeholder")}
                          defaultValue={req.public_note || ""}
                        />
                      </div>
                      <div>
                        <label className="label">{t("tl_events.quoting_notes")}</label>
                        <textarea
                          name="quotingNotes"
                          rows={3}
                          className="input w-full"
                          placeholder={t("tl_events.quoting_notes_placeholder")}
                          defaultValue={req.notes || ""}
                        />
                      </div>
                      <div>
                        <label className="label">{t("tl_events.event_photo_replace")}</label>
                        <input type="file" name="eventImage" accept="image/jpeg,image/png,image/webp" className="input pt-2" />
                        <p className="mt-1 text-xs text-gray-500">{t("tl_events.event_photo_help")}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="submit" className="btn-primary rounded-full text-sm">{t("tl_events.save_resubmit")}</button>
                      </div>
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
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 text-sm text-gray-500">{t("tl_events.none")}</div>
            )}
          </div>
        </div>
      </main>
    </div>
    </ControlPanelLayout>
  );
}
