import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { requireSuperAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { sendTemplatedEmail } from "~/lib/email/service.server";
import { normalizeEmailLocale } from "~/lib/email/types";
import { applyListingPublicIdFilter } from "~/lib/publicIds";

const STATUS_OPTIONS = [
  "under_review",
  "quoting",
  "changes_requested",
  "approved",
  "scheduled",
  "rejected",
  "published",
] as const;
const TL_EVENT_STATUS_KIND = "tl_event_status_update";
const TL_EVENT_MESSAGE_KIND = "tl_event_message";
const EVENT_QUOTE_ATTACHMENT_BUCKET = "event-request-quotes";
const MAX_QUOTE_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_QUOTE_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function getQuoteAttachmentExt(mimeType: string) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "bin";
}

async function uploadQuoteAttachment(args: {
  file: File;
  requestId: string;
  quoteId: string;
}) {
  const { file, requestId, quoteId } = args;
  if (!ALLOWED_QUOTE_ATTACHMENT_TYPES.has(file.type)) {
    return { error: "Invalid attachment format. Allowed: PDF, JPG, PNG, WEBP." };
  }
  if (file.size <= 0 || file.size > MAX_QUOTE_ATTACHMENT_BYTES) {
    return { error: "Attachment must be between 1 byte and 10MB." };
  }

  const { data: bucket } = await supabaseAdmin.storage.getBucket(EVENT_QUOTE_ATTACHMENT_BUCKET);
  if (!bucket) {
    await supabaseAdmin.storage.createBucket(EVENT_QUOTE_ATTACHMENT_BUCKET, { public: true });
  }

  const ext = getQuoteAttachmentExt(file.type);
  const path = `${requestId}/${quoteId}/${Date.now()}.${ext}`;
  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage
    .from(EVENT_QUOTE_ATTACHMENT_BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      upsert: true,
      cacheControl: "3600",
    });

  if (uploadError) {
    return { error: `Attachment upload failed: ${uploadError.message}` };
  }

  const { data: publicData } = supabaseAdmin.storage.from(EVENT_QUOTE_ATTACHMENT_BUCKET).getPublicUrl(path);
  return { path, url: publicData.publicUrl };
}
const REQUEST_PRIORITY: Record<string, number> = {
  changes_requested: 1,
  approved: 2,
  scheduled: 3,
  under_review: 4,
  quoting: 5,
  rejected: 6,
  published: 99,
};
const STATUS_PILL_CLASSES: Record<string, string> = {
  under_review: "bg-amber-100 text-amber-800 border-amber-200",
  quoting: "bg-sky-100 text-sky-800 border-sky-200",
  changes_requested: "bg-orange-100 text-orange-800 border-orange-200",
  approved: "bg-indigo-100 text-indigo-800 border-indigo-200",
  scheduled: "bg-cyan-100 text-cyan-800 border-cyan-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  published: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export const meta: MetaFunction = () => [{ title: "Event Requests - Admin - Runoot" }];

function formatDateStable(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function getPublishedEventEmailCopy(localeInput: string | null | undefined, eventName: string) {
  const locale = normalizeEmailLocale(localeInput);
  const copy = {
    en: {
      referralTitle: "New Team Event Published",
      referralMessage: `${eventName} is now available in listings.`,
      teamLeaderTitle: "Your event is now published",
      teamLeaderMessage: `${eventName} has been approved and is now live in listings.`,
      cta: "Open listing",
    },
    it: {
      referralTitle: "Nuovo evento del Team pubblicato",
      referralMessage: `${eventName} e ora disponibile negli annunci.`,
      teamLeaderTitle: "Il tuo evento e ora pubblicato",
      teamLeaderMessage: `${eventName} e stato approvato ed e ora online negli annunci.`,
      cta: "Apri annuncio",
    },
    de: {
      referralTitle: "Neues Team-Event veroffentlicht",
      referralMessage: `${eventName} ist jetzt in den Angeboten verfugbar.`,
      teamLeaderTitle: "Dein Event ist jetzt veroffentlicht",
      teamLeaderMessage: `${eventName} wurde freigegeben und ist jetzt in den Angeboten sichtbar.`,
      cta: "Angebot offnen",
    },
    fr: {
      referralTitle: "Nouvel evenement d'equipe publie",
      referralMessage: `${eventName} est maintenant disponible dans les annonces.`,
      teamLeaderTitle: "Votre evenement est maintenant publie",
      teamLeaderMessage: `${eventName} a ete approuve et est maintenant en ligne dans les annonces.`,
      cta: "Ouvrir l'annonce",
    },
    es: {
      referralTitle: "Nuevo evento del equipo publicado",
      referralMessage: `${eventName} ya esta disponible en listados.`,
      teamLeaderTitle: "Tu evento ya esta publicado",
      teamLeaderMessage: `${eventName} ha sido aprobado y ya esta activo en listados.`,
      cta: "Abrir listado",
    },
    nl: {
      referralTitle: "Nieuw teamevenement gepubliceerd",
      referralMessage: `${eventName} is nu beschikbaar in advertenties.`,
      teamLeaderTitle: "Je evenement is nu gepubliceerd",
      teamLeaderMessage: `${eventName} is goedgekeurd en staat nu live in advertenties.`,
      cta: "Advertentie openen",
    },
    pt: {
      referralTitle: "Novo evento do time publicado",
      referralMessage: `${eventName} agora esta disponivel nos anuncios.`,
      teamLeaderTitle: "Seu evento agora esta publicado",
      teamLeaderMessage: `${eventName} foi aprovado e agora esta ativo nos anuncios.`,
      cta: "Abrir anuncio",
    },
  } as const;

  return copy[locale];
}

function getStatusUpdateEmailCopy(
  localeInput: string | null | undefined,
  eventName: string,
  nextStatus: string,
  adminNote?: string
) {
  const locale = normalizeEmailLocale(localeInput);

  const statusLabelByLocale = {
    en: {
      under_review: "Under review",
      quoting: "Quoting",
      changes_requested: "Changes requested",
      approved: "Approved",
      scheduled: "Scheduled",
      rejected: "Rejected",
      published: "Published",
    },
    it: {
      under_review: "In revisione",
      quoting: "In quotazione",
      changes_requested: "Modifiche richieste",
      approved: "Approvata",
      scheduled: "Programmato",
      rejected: "Rifiutata",
      published: "Pubblicata",
    },
    de: {
      under_review: "In Prufung",
      quoting: "Angebotsphase",
      changes_requested: "Anderungen angefordert",
      approved: "Genehmigt",
      scheduled: "Geplant",
      rejected: "Abgelehnt",
      published: "Veroffentlicht",
    },
    fr: {
      under_review: "En revision",
      quoting: "Devis en cours",
      changes_requested: "Modifications demandees",
      approved: "Approuve",
      scheduled: "Planifie",
      rejected: "Rejete",
      published: "Publie",
    },
    es: {
      under_review: "En revision",
      quoting: "En cotizacion",
      changes_requested: "Cambios solicitados",
      approved: "Aprobado",
      scheduled: "Programado",
      rejected: "Rechazado",
      published: "Publicado",
    },
    nl: {
      under_review: "In beoordeling",
      quoting: "Offertefase",
      changes_requested: "Wijzigingen gevraagd",
      approved: "Goedgekeurd",
      scheduled: "Gepland",
      rejected: "Afgewezen",
      published: "Gepubliceerd",
    },
    pt: {
      under_review: "Em revisao",
      quoting: "Em cotacao",
      changes_requested: "Alteracoes solicitadas",
      approved: "Aprovado",
      scheduled: "Agendado",
      rejected: "Rejeitado",
      published: "Publicado",
    },
  } as const;

  const labels = statusLabelByLocale[locale];
  const localizedStatus = (labels as any)?.[nextStatus] || nextStatus;

  const copy = {
    en: {
      title: "Event request status updated",
      message: `${eventName} status is now: ${localizedStatus}.${adminNote ? `\n\nAdmin note: ${adminNote}` : ""}`,
      cta: "Open Event Requests",
    },
    it: {
      title: "Stato richiesta evento aggiornato",
      message: `Lo stato di ${eventName} e ora: ${localizedStatus}.${adminNote ? `\n\nNota admin: ${adminNote}` : ""}`,
      cta: "Apri richieste evento",
    },
    de: {
      title: "Status der Event-Anfrage aktualisiert",
      message: `Der Status von ${eventName} ist jetzt: ${localizedStatus}.${adminNote ? `\n\nAdmin-Hinweis: ${adminNote}` : ""}`,
      cta: "Event-Anfragen offnen",
    },
    fr: {
      title: "Statut de la demande d'evenement mis a jour",
      message: `Le statut de ${eventName} est maintenant : ${localizedStatus}.${adminNote ? `\n\nNote admin : ${adminNote}` : ""}`,
      cta: "Ouvrir les demandes d'evenements",
    },
    es: {
      title: "Estado de la solicitud de evento actualizado",
      message: `El estado de ${eventName} ahora es: ${localizedStatus}.${adminNote ? `\n\nNota del administrador: ${adminNote}` : ""}`,
      cta: "Abrir solicitudes de eventos",
    },
    nl: {
      title: "Status van evenementaanvraag bijgewerkt",
      message: `De status van ${eventName} is nu: ${localizedStatus}.${adminNote ? `\n\nBeheerdernotitie: ${adminNote}` : ""}`,
      cta: "Evenementaanvragen openen",
    },
    pt: {
      title: "Status da solicitacao de evento atualizado",
      message: `O status de ${eventName} agora e: ${localizedStatus}.${adminNote ? `\n\nNota do admin: ${adminNote}` : ""}`,
      cta: "Abrir solicitacoes de evento",
    },
  } as const;

  return copy[locale];
}

function getDirectTlMessageEmailCopy(
  localeInput: string | null | undefined,
  eventName: string,
  message: string
) {
  const locale = normalizeEmailLocale(localeInput);
  const copy = {
    en: {
      title: "Message from admin about your event request",
      body: `Event: ${eventName}\n\n${message}`,
      cta: "Open Event Requests",
    },
    it: {
      title: "Messaggio admin sulla tua richiesta evento",
      body: `Evento: ${eventName}\n\n${message}`,
      cta: "Apri richieste evento",
    },
    de: {
      title: "Admin-Nachricht zu deiner Event-Anfrage",
      body: `Event: ${eventName}\n\n${message}`,
      cta: "Event-Anfragen offnen",
    },
    fr: {
      title: "Message admin concernant votre demande d'evenement",
      body: `Evenement : ${eventName}\n\n${message}`,
      cta: "Ouvrir les demandes d'evenements",
    },
    es: {
      title: "Mensaje del administrador sobre tu solicitud de evento",
      body: `Evento: ${eventName}\n\n${message}`,
      cta: "Abrir solicitudes de eventos",
    },
    nl: {
      title: "Beheerdersbericht over je evenementaanvraag",
      body: `Evenement: ${eventName}\n\n${message}`,
      cta: "Evenementaanvragen openen",
    },
    pt: {
      title: "Mensagem do admin sobre sua solicitacao de evento",
      body: `Evento: ${eventName}\n\n${message}`,
      cta: "Abrir solicitacoes de evento",
    },
  } as const;
  return copy[locale];
}

function getUpdateAuthorMeta(update: any) {
  if (update?.actor_role === "team_leader" && update?.action === "created_under_review") {
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

  const { data: requestsRaw } = await (supabaseAdmin.from("event_requests") as any)
    .select("*, team_leader:profiles!event_requests_team_leader_id_fkey(id, full_name, email)")
    .order("created_at", { ascending: false });
  const requests = (requestsRaw || []).filter((req: any) => !req.archived_at);

  const requestIds = (requests || []).map((r: any) => r.id);
  let updatesByRequest: Record<string, any[]> = {};
  let quotesByRequest: Record<string, any[]> = {};

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
  }

  return { requests: requests || [], updatesByRequest, quotesByRequest };
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

  if (actionType === "archiveRequest") {
    const nowIso = new Date().toISOString();
    const { error: archiveError } = await (supabaseAdmin.from("event_requests") as any)
      .update({
        archived_at: nowIso,
        archived_by: (admin as any).id,
        updated_at: nowIso,
      })
      .eq("id", requestId);

    if (archiveError) {
      return data({ error: `Failed to archive request: ${archiveError.message}` }, { status: 500 });
    }

    await (supabaseAdmin.from("event_request_updates") as any).insert({
      event_request_id: requestId,
      actor_id: (admin as any).id,
      actor_role: "superadmin",
      action: "archived",
      note: note || "Archived by superadmin",
    });

    return data({ success: true, message: "Request archived." });
  }

  if (actionType === "deleteRequest") {
    await (supabaseAdmin.from("event_request_updates") as any)
      .delete()
      .eq("event_request_id", requestId);

    const { error: deleteError } = await (supabaseAdmin.from("event_requests") as any)
      .delete()
      .eq("id", requestId);

    if (deleteError) {
      return data({ error: `Failed to delete request: ${deleteError.message}` }, { status: 500 });
    }

    return data({ success: true, message: "Request deleted." });
  }

  if (actionType === "addQuote") {
    const agencyName = String(formData.get("agencyName") || "").trim();
    const packageTitle = String(formData.get("packageTitle") || "").trim();
    const totalPriceRaw = Number(formData.get("totalPrice") || "0");
    const currency = String(formData.get("currency") || "EUR").trim().toUpperCase() || "EUR";
    const summary = String(formData.get("summary") || "").trim();
    const includes = String(formData.get("includes") || "").trim();
    const excludes = String(formData.get("excludes") || "").trim();
    const cancellationPolicy = String(formData.get("cancellationPolicy") || "").trim();
    const paymentTerms = String(formData.get("paymentTerms") || "").trim();
    const validUntil = String(formData.get("validUntil") || "").trim();
    const isRecommended = String(formData.get("isRecommended") || "") === "on";
    const quoteAttachment = formData.get("quoteAttachment");

    if (!agencyName || totalPriceRaw <= 0) {
      return data({ error: "Agency name and price are required." }, { status: 400 });
    }

    const quoteId = crypto.randomUUID();
    const { error: insertError } = await (supabaseAdmin.from("event_request_quotes") as any).insert({
      id: quoteId,
      event_request_id: requestId,
      agency_name: agencyName,
      package_title: packageTitle || null,
      total_price: totalPriceRaw,
      currency,
      summary: summary || null,
      includes: includes || null,
      excludes: excludes || null,
      cancellation_policy: cancellationPolicy || null,
      payment_terms: paymentTerms || null,
      valid_until: validUntil || null,
      is_recommended: isRecommended,
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      return data({ error: `Failed to add quote: ${insertError.message}` }, { status: 500 });
    }

    if (quoteAttachment instanceof File && quoteAttachment.size > 0) {
      const uploaded = await uploadQuoteAttachment({
        file: quoteAttachment,
        requestId,
        quoteId,
      });
      if ("error" in uploaded) {
        return data({ error: uploaded.error }, { status: 400 });
      }
      await (supabaseAdmin.from("event_request_quotes") as any)
        .update({
          attachment_url: uploaded.url,
          attachment_path: uploaded.path,
          attachment_name: quoteAttachment.name || null,
          attachment_mime: quoteAttachment.type || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", quoteId);
    }

    await (supabaseAdmin.from("event_request_updates") as any).insert({
      event_request_id: requestId,
      actor_id: (admin as any).id,
      actor_role: "superadmin",
      action: "quote_added",
      note: `Quote added from ${agencyName} (${currency} ${totalPriceRaw})`,
    });

    return data({ success: true, message: "Quote added." });
  }

  if (actionType === "deleteQuote") {
    const quoteId = String(formData.get("quoteId") || "");
    if (!quoteId) return data({ error: "Missing quote id." }, { status: 400 });

    const { error: deleteQuoteError } = await (supabaseAdmin.from("event_request_quotes") as any)
      .delete()
      .eq("id", quoteId)
      .eq("event_request_id", requestId);

    if (deleteQuoteError) {
      return data({ error: `Failed to delete quote: ${deleteQuoteError.message}` }, { status: 500 });
    }

    await (supabaseAdmin.from("event_request_updates") as any).insert({
      event_request_id: requestId,
      actor_id: (admin as any).id,
      actor_role: "superadmin",
      action: "quote_deleted",
      note: `Quote removed (${quoteId})`,
    });

    return data({ success: true, message: "Quote deleted." });
  }

  if (actionType === "deleteNote") {
    const updateId = String(formData.get("updateId") || "");
    if (!updateId) return data({ error: "Missing note id." }, { status: 400 });

    const { error: deleteNoteError } = await (supabaseAdmin.from("event_request_updates") as any)
      .delete()
      .eq("id", updateId)
      .eq("event_request_id", requestId);

    if (deleteNoteError) {
      return data({ error: `Failed to delete note: ${deleteNoteError.message}` }, { status: 500 });
    }

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
    const previousStatus = String(existing.status || "");

    if ((nextStatus === "changes_requested" || nextStatus === "rejected") && !note) {
      return data({ error: "TL message is required for changes requested or rejected status." }, { status: 400 });
    }

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

    const effectiveSelectedAgency = selectedAgency || existing.selected_agency_name || "";
    const effectiveQuoteSummary = quoteSummary || existing.quote_summary || "";
    const includeQuoteInfoForTl =
      previousStatus === "quoting" &&
      nextStatus !== "quoting" &&
      (!!effectiveSelectedAgency || !!effectiveQuoteSummary);
    const quoteInfoBlock = includeQuoteInfoForTl
      ? [
          effectiveSelectedAgency ? `Selected agency: ${effectiveSelectedAgency}` : null,
          effectiveQuoteSummary ? `Quote summary: ${effectiveQuoteSummary}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "";

    const timelineMessage = [
      `Status changed: ${previousStatus || "unknown"} -> ${nextStatus}`,
      note || null,
      quoteInfoBlock || null,
    ]
      .filter(Boolean)
      .join("\n\n");

    await (supabaseAdmin.from("event_request_updates") as any).insert({
      event_request_id: requestId,
      actor_id: (admin as any).id,
      actor_role: "superadmin",
      action: `status_changed_to_${nextStatus}`,
      note: timelineMessage,
    });

    let emailError: string | null = null;
    const { data: tlProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, preferred_language")
      .eq("id", existing.team_leader_id)
      .maybeSingle();

    if (tlProfile?.email) {
      const emailCopy = getStatusUpdateEmailCopy(
        (tlProfile as any).preferred_language,
        existing.event_name,
        nextStatus,
        [note || null, quoteInfoBlock || null].filter(Boolean).join("\n\n") || undefined
      );
      const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
      const emailResult = await sendTemplatedEmail({
        to: tlProfile.email,
        templateId: "platform_notification",
        locale: (tlProfile as any).preferred_language || null,
        payload: {
          title: emailCopy.title,
          message: emailCopy.message,
          ctaLabel: emailCopy.cta,
          ctaUrl: `${appUrl}/tl-events`,
        },
      });
      if (!emailResult.ok) {
        emailError = emailResult.error || "unknown email error";
      }
    }

    if (nextStatus !== previousStatus) {
      await (supabaseAdmin.from("notifications") as any).insert({
        user_id: existing.team_leader_id,
        type: "system",
        title: `Event request status updated`,
        message: `${existing.event_name}: ${previousStatus || "unknown"} -> ${nextStatus}`,
        data: {
          kind: TL_EVENT_STATUS_KIND,
          event_request_id: requestId,
          previous_status: previousStatus || null,
          next_status: nextStatus,
        },
      });
    }

    return data({
      success: true,
      message: emailError
        ? `Status updated to ${nextStatus}, but email failed: ${emailError}`
        : `Status updated to ${nextStatus}. Email sent to Team Leader.`,
    });
  }

  if (actionType === "sendTlMessage") {
    const tlMessage = String(formData.get("tlMessage") || "").trim();
    if (!tlMessage) {
      return data({ error: "TL message cannot be empty." }, { status: 400 });
    }

    await (supabaseAdmin.from("event_request_updates") as any).insert({
      event_request_id: requestId,
      actor_id: (admin as any).id,
      actor_role: "superadmin",
      action: "direct_message_to_tl",
      note: tlMessage,
    });

    const { data: tlProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, preferred_language")
      .eq("id", existing.team_leader_id)
      .maybeSingle();

    if (tlProfile?.email) {
      const emailCopy = getDirectTlMessageEmailCopy(
        (tlProfile as any).preferred_language,
        existing.event_name,
        tlMessage
      );
      const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
      await sendTemplatedEmail({
        to: tlProfile.email,
        templateId: "platform_notification",
        locale: (tlProfile as any).preferred_language || null,
        payload: {
          title: emailCopy.title,
          message: emailCopy.body,
          ctaLabel: emailCopy.cta,
          ctaUrl: `${appUrl}/tl-events`,
        },
      });
    }

    await (supabaseAdmin.from("notifications") as any).insert({
      user_id: existing.team_leader_id,
      type: "system",
      title: "New message from admin",
      message: `${existing.event_name}: ${tlMessage.slice(0, 120)}${tlMessage.length > 120 ? "..." : ""}`,
      data: {
        kind: TL_EVENT_MESSAGE_KIND,
        event_request_id: requestId,
      },
    });

    return data({ success: true, message: "Message sent to Team Leader." });
  }

  if (actionType === "publishAndNotify") {
    const listingUrl = String(formData.get("listingUrl") || "").trim();
    if (!listingUrl) return data({ error: "Listing URL is required." }, { status: 400 });
    if (existing.status !== "approved") {
      return data({ error: "You can publish only after request is approved." }, { status: 400 });
    }

    await (supabaseAdmin.from("event_requests") as any)
      .update({
        status: "published",
        published_listing_url: listingUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    // If TL uploaded an image, bind it to the related event card image.
    // We resolve event_id from listing URL public id (short_id or uuid).
    if (existing.event_image_url) {
      const listingPublicId = listingUrl.replace(/\/+$/, "").split("/").pop() || "";
      if (listingPublicId) {
        const listingLookup = (supabaseAdmin as any)
          .from("listings")
          .select("id, event_id");
        const { data: publishListing } = await applyListingPublicIdFilter(listingLookup, listingPublicId).maybeSingle();
        if (publishListing?.event_id) {
          await (supabaseAdmin.from("events") as any)
            .update({ card_image_url: existing.event_image_url })
            .eq("id", publishListing.event_id);
        }
      }
    }

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
        .select("id, email, preferred_language")
        .in("id", referralIds);

      for (const profile of referralProfiles || []) {
        const emailCopy = getPublishedEventEmailCopy((profile as any).preferred_language, existing.event_name);
        await (supabaseAdmin.from("notifications") as any).insert({
          user_id: profile.id,
          type: "system",
          title: emailCopy.referralTitle,
          message: emailCopy.referralMessage,
          data: { kind: "team_event_published", event_request_id: requestId, listing_url: listingUrl },
        });

        await sendTemplatedEmail({
          to: profile.email,
          templateId: "platform_notification",
          locale: (profile as any).preferred_language || null,
          payload: {
            title: emailCopy.referralTitle,
            message: emailCopy.referralMessage,
            ctaLabel: emailCopy.cta,
            ctaUrl: listingUrl,
          },
        });
      }
    }

    const { data: tlProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, preferred_language")
      .eq("id", existing.team_leader_id)
      .maybeSingle();

    if (tlProfile?.email) {
      const emailCopy = getPublishedEventEmailCopy((tlProfile as any).preferred_language, existing.event_name);
      await sendTemplatedEmail({
        to: tlProfile.email,
        templateId: "platform_notification",
        locale: (tlProfile as any).preferred_language || null,
        payload: {
          title: emailCopy.teamLeaderTitle,
          message: emailCopy.teamLeaderMessage,
          ctaLabel: emailCopy.cta,
          ctaUrl: listingUrl,
        },
      });
    }

    return data({ success: true, message: `Published and notified ${referralIds.length} referrals.` });
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function AdminEventRequestsPage() {
  const { requests, updatesByRequest, quotesByRequest } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as { error?: string; success?: boolean; message?: string } | undefined;
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"requests" | "listed">("requests");
  const [previewImage, setPreviewImage] = useState<{ url: string; alt: string } | null>(null);

  const sortedRequests = useMemo(() => requests || [], [requests]);
  const requestsCount = useMemo(
    () => sortedRequests.filter((req: any) => req.status !== "published").length,
    [sortedRequests]
  );
  const listedCount = useMemo(
    () => sortedRequests.filter((req: any) => req.status === "published").length,
    [sortedRequests]
  );
  const visibleRequests = useMemo(
    () =>
      sortedRequests
        .filter((req: any) => (activeTab === "listed" ? req.status === "published" : req.status !== "published"))
        .sort((a: any, b: any) => {
          if (activeTab === "listed") {
            return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
          }
          const pa = REQUEST_PRIORITY[a.status] ?? 50;
          const pb = REQUEST_PRIORITY[b.status] ?? 50;
          if (pa !== pb) return pa - pb;
          return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
        }),
    [activeTab, sortedRequests]
  );

  function toggleRow(id: string) {
    setOpenRows((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleNote(noteId: string) {
    setExpandedNotes((prev) => ({ ...prev, [noteId]: !prev[noteId] }));
  }

  useEffect(() => {
    if (!previewImage) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewImage(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewImage]);

  return (
    <div>
      {previewImage && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -right-2 -top-2 z-10 h-8 w-8 rounded-full bg-white/90 text-gray-900 shadow-md hover:bg-white"
              aria-label="Close preview"
            >
              ×
            </button>
            <img
              src={previewImage.url}
              alt={previewImage.alt}
              className="max-h-[90vh] max-w-[90vw] rounded-lg border border-white/20 object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("requests")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "requests"
              ? "bg-brand-600 text-white shadow-md shadow-brand-500/25"
              : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          Requests ({requestsCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("listed")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "listed"
              ? "bg-brand-600 text-white shadow-md shadow-brand-500/25"
              : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          Listed ({listedCount})
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="space-y-3 p-3">
          {visibleRequests.length > 0 ? (
            visibleRequests.map((req: any) => (
              <div key={req.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-gray-900">{req.event_name}</p>
                    <p className="text-sm text-gray-600">
                      {req.event_location} · {formatDateStable(req.event_date)} · {req.request_type} · {req.people_count} people
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      TL: {(req.team_leader?.full_name || req.team_leader?.email || "Unknown").toString()}
                    </p>
                    <div className="mt-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_PILL_CLASSES[req.status] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                        {req.status}
                      </span>
                      {req.event_image_url && (
                        <span className="ml-2 inline-flex rounded-full border border-sky-200 bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
                          Photo attached
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeTab === "listed" && req.published_listing_url && (
                      <a
                        href={req.published_listing_url}
                        target="_blank"
                        rel="noreferrer"
                        className="h-10 px-4 inline-flex items-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm font-semibold"
                      >
                        View
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setPendingDelete({ id: req.id, name: req.event_name })}
                      className="h-10 px-4 rounded-full border border-alert-300 bg-white text-alert-700 hover:bg-alert-50 text-sm font-semibold"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleRow(req.id)}
                      className="h-10 px-4 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold shadow-md shadow-brand-500/30"
                      aria-label={openRows[req.id] ? "Close details" : "Open details"}
                    >
                      {openRows[req.id] ? "Close" : "Open"}
                    </button>
                  </div>
                </div>

                {openRows[req.id] && (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-4">
                    <section>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Summary</p>
                      <div className="mt-2 space-y-1">
                        {req.event_image_url && (
                          <div className="mb-3 flex justify-start">
                            <button
                              type="button"
                              onClick={() => setPreviewImage({ url: req.event_image_url, alt: req.event_name })}
                              className="h-20 w-28 overflow-hidden rounded-md border border-gray-200 shadow-sm"
                              aria-label="Open event photo preview"
                            >
                              <img
                                src={req.event_image_url}
                                alt={req.event_name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </button>
                          </div>
                        )}
                        {req.public_note && <p className="text-sm text-gray-700"><span className="font-semibold text-gray-900">Announcement note:</span> {req.public_note}</p>}
                        {req.notes && <p className="text-sm text-gray-700"><span className="font-semibold text-gray-900">Quoting notes:</span> {req.notes}</p>}
                        {req.quote_summary && <p className="text-sm text-gray-700"><span className="font-semibold text-gray-900">Quote summary:</span> {req.quote_summary}</p>}
                        {req.selected_agency_name && <p className="text-sm text-gray-700"><span className="font-semibold text-gray-900">Selected agency:</span> {req.selected_agency_name}</p>}
                        {req.internal_admin_note && <p className="text-sm text-gray-700"><span className="font-semibold text-gray-900">Internal note:</span> {req.internal_admin_note}</p>}
                        {req.tl_event_details && <p className="text-sm text-gray-700"><span className="font-semibold text-gray-900">TL event details:</span> {req.tl_event_details}</p>}
                        {req.published_listing_url && (
                          <a href={req.published_listing_url} className="inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
                            Open listing →
                          </a>
                        )}
                      </div>
                    </section>

                    <section className="border-t border-gray-200 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Quote Options</p>
                      <div className="mt-2 space-y-2">
                        {(quotesByRequest[req.id] || []).length > 0 ? (
                          (quotesByRequest[req.id] || []).map((quote: any) => (
                            <div key={quote.id} className="rounded-lg border border-gray-200 bg-white p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {quote.agency_name}
                                    {quote.package_title ? ` · ${quote.package_title}` : ""}
                                  </p>
                                  <p className="mt-0.5 text-sm text-gray-700">
                                    {quote.currency} {quote.total_price}
                                    {quote.valid_until ? ` · valid until ${formatDateStable(quote.valid_until)}` : ""}
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-2">
                                    {quote.is_recommended && (
                                      <span className="rounded-full border border-brand-200 bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
                                        Recommended
                                      </span>
                                    )}
                                    {quote.is_selected && (
                                      <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                        Selected by TL
                                      </span>
                                    )}
                                  </div>
                                {quote.summary && <p className="mt-2 text-sm text-gray-700">{quote.summary}</p>}
                                  {quote.attachment_url && (
                                    <a
                                      href={quote.attachment_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-2 inline-block text-xs font-semibold text-brand-700 hover:text-brand-800"
                                    >
                                      Download attachment
                                    </a>
                                  )}
                                </div>
                                <Form method="post">
                                  <input type="hidden" name="_action" value="deleteQuote" />
                                  <input type="hidden" name="requestId" value={req.id} />
                                  <input type="hidden" name="quoteId" value={quote.id} />
                                  <button type="submit" className="rounded-full border border-alert-300 px-3 py-1 text-xs font-semibold text-alert-700 hover:bg-alert-50">
                                    Delete
                                  </button>
                                </Form>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">No quotes yet.</p>
                        )}
                      </div>
                      <Form method="post" encType="multipart/form-data" className="mt-3 grid gap-2 rounded-lg border border-gray-200 bg-white p-3 md:grid-cols-2">
                        <input type="hidden" name="_action" value="addQuote" />
                        <input type="hidden" name="requestId" value={req.id} />
                        <input name="agencyName" className="input" placeholder="Agency name *" required />
                        <input name="packageTitle" className="input" placeholder="Package title" />
                        <input name="totalPrice" type="number" min={1} step="0.01" className="input" placeholder="Total price *" required />
                        <input name="currency" className="input" placeholder="Currency (EUR)" defaultValue="EUR" />
                        <input name="validUntil" type="date" className="input" />
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" name="isRecommended" />
                          Recommended
                        </label>
                        <textarea name="summary" rows={2} className="input w-full md:col-span-2" placeholder="Summary / key highlights" />
                        <textarea name="includes" rows={2} className="input w-full" placeholder="Includes (optional)" />
                        <textarea name="excludes" rows={2} className="input w-full" placeholder="Excludes (optional)" />
                        <textarea name="cancellationPolicy" rows={2} className="input w-full" placeholder="Cancellation policy (optional)" />
                        <textarea name="paymentTerms" rows={2} className="input w-full" placeholder="Payment terms (optional)" />
                        <div className="md:col-span-2">
                          <input type="file" name="quoteAttachment" accept="application/pdf,image/jpeg,image/png,image/webp" className="input pt-2" />
                          <p className="mt-1 text-xs text-gray-500">Attachment optional: PDF/JPG/PNG/WEBP, max 10MB.</p>
                        </div>
                        <div className="md:col-span-2">
                          <button type="submit" className="btn-secondary rounded-full text-sm">Add quote option</button>
                        </div>
                      </Form>
                    </section>

                    <section className="border-t border-gray-200 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Timeline Notes</p>
                      <div className="mt-2">
                        {(updatesByRequest[req.id] || []).length > 0 ? (
                          <div className="space-y-2">
                            {(updatesByRequest[req.id] || []).map((u: any, idx: number) => (
                              <div key={`${u.id}-${idx}`} className="flex items-start gap-3">
                                <div className="min-w-0 w-full rounded-lg border border-gray-200 bg-white px-3 py-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs text-gray-500">{formatDateStable(u.created_at)}</p>
                                      <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${getUpdateAuthorMeta(u).className}`}>
                                          {getUpdateAuthorMeta(u).label}
                                        </span>
                                        <Form method="post">
                                          <input type="hidden" name="_action" value="deleteNote" />
                                          <input type="hidden" name="requestId" value={req.id} />
                                          <input type="hidden" name="updateId" value={u.id} />
                                          <button
                                            type="submit"
                                            className="rounded-full border border-alert-200 px-2 py-0.5 text-[11px] font-semibold text-alert-700 hover:bg-alert-50"
                                            title="Delete note"
                                          >
                                            Delete
                                          </button>
                                        </Form>
                                      </div>
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
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No notes yet.</p>
                        )}
                      </div>
                    </section>

                    {activeTab === "requests" && (
                      <section className="border-t border-gray-200 pt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</p>
                        <div className="mt-2">
                          <Link
                            to={`/admin/events/new?requestId=${req.id}`}
                            className="inline-flex items-center rounded-full border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100"
                          >
                            Create Event Listing
                          </Link>
                        </div>
                        <div className="mt-2 grid md:grid-cols-2 gap-3">
                          <Form method="post" className="space-y-2">
                            <input type="hidden" name="_action" value="setStatus" />
                            <input type="hidden" name="requestId" value={req.id} />
                            <label className="label">Change status</label>
                            <select name="nextStatus" defaultValue={req.status} className="input w-full md:w-auto md:min-w-[220px]">
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-500">
                              TL message is mandatory when setting status to <span className="font-semibold">changes_requested</span> or <span className="font-semibold">rejected</span>.
                            </p>
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
                            <textarea
                              name="note"
                              rows={2}
                              className="input w-full"
                              placeholder="TL message (required for changes_requested and rejected)"
                            />
                            <button type="submit" className="btn-secondary rounded-full text-sm">Save Status</button>
                          </Form>

                          {req.status === "approved" || req.status === "scheduled" ? (
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
                              {req.event_image_url && (
                                <p className="text-xs text-gray-500">
                                  TL photo detected. It will be applied automatically as event card image on publish.
                                </p>
                              )}
                              <textarea name="note" rows={2} className="input w-full" placeholder="Optional publish note" />
                              <button type="submit" className="btn-primary rounded-full text-sm">Publish & Notify</button>
                            </Form>
                          ) : (
                            <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600">
                              Publish action is available only when status is <span className="font-semibold">approved</span> or <span className="font-semibold">scheduled</span>.
                            </div>
                          )}
                        </div>
                      </section>
                    )}

                    <section className="border-t border-gray-200 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">TL Message</p>
                      <Form method="post" className="mt-2 space-y-2">
                        <input type="hidden" name="_action" value="sendTlMessage" />
                        <input type="hidden" name="requestId" value={req.id} />
                        <textarea
                          name="tlMessage"
                          rows={2}
                          className="input w-full"
                          placeholder="Send a direct message to Team Leader"
                          required
                        />
                        <button type="submit" className="btn-secondary rounded-full text-sm">Send TL Message</button>
                      </Form>
                    </section>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white/95 p-6 text-sm text-gray-500">
              {activeTab === "listed" ? "No published events yet." : "No event requests yet."}
            </div>
          )}
        </div>
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Remove request</h3>
            <p className="mt-2 text-sm text-gray-600">
              Choose what to do with <span className="font-semibold text-gray-900">{pendingDelete.name}</span>.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <Form method="post" onSubmit={() => setPendingDelete(null)}>
                <input type="hidden" name="_action" value="archiveRequest" />
                <input type="hidden" name="requestId" value={pendingDelete.id} />
                <button
                  type="submit"
                  className="rounded-full border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100"
                >
                  Archive
                </button>
              </Form>
              <Form method="post" onSubmit={() => setPendingDelete(null)}>
                <input type="hidden" name="_action" value="deleteRequest" />
                <input type="hidden" name="requestId" value={pendingDelete.id} />
                <button
                  type="submit"
                  className="rounded-full bg-alert-600 px-4 py-2 text-sm font-semibold text-white hover:bg-alert-700"
                >
                  Delete permanently
                </button>
              </Form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
