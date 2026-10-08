import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { CampaignContent } from "./mailing-list";
import { createMailingBroadcast, getMailingBroadcast, sendMailingBroadcast } from "./mailing-provider.server";

type Client = SupabaseClient<Database>;
export type MailingCampaign = Database["public"]["Tables"]["mailing_list_campaigns"]["Row"];
const table = "mailing_list_campaigns";
const changed = "This email was changed or is already being sent. Refresh the page before continuing.";

export async function saveMailingDraft(client: Client, content: CampaignContent, adminId: string, existing?: { id: string; version: string }) {
  const values = { subject: content.subject, preview_text: content.preview_text, body: content.body, button_label: content.button_label, button_url: content.button_url };
  const result = existing
    ? await client.from(table).update({ ...values, updated_at: new Date(Math.max(Date.now(), Date.parse(existing.version) + 1)).toISOString() }).eq("id", existing.id).eq("state", "draft").eq("updated_at", existing.version).select("id").maybeSingle()
    : await client.from(table).insert({ ...values, created_by: adminId }).select("id").single();
  if (result.error) throw new Error("Could not save this email. Please try again.");
  if (!result.data) throw new Error(changed);
  return result.data.id;
}

export async function sendMailingCampaign(client: Client, id: string, version: string) {
  const found = await client.from(table).select("*").eq("id", id).single();
  if (found.error || !found.data) throw new Error("Email not found.");
  let campaign = found.data;
  if (campaign.updated_at !== version || !["draft", "ready"].includes(campaign.state)) throw new Error(changed);
  if (campaign.state === "draft") {
    const claimed = await client.from(table).update({ state: "preparing", updated_at: new Date().toISOString(), last_error: null })
      .eq("id", id).eq("state", "draft").eq("updated_at", version).select("*").maybeSingle();
    if (claimed.error || !claimed.data) throw new Error(changed);
    campaign = claimed.data;
    try {
      // Persist the remote draft before sending. An interrupted prepare can only
      // leave an unsent draft at the provider, never an untracked live campaign.
      const broadcast = await createMailingBroadcast(campaign);
      const saved = await client.from(table).update({ state: "ready", resend_broadcast_id: broadcast.id, updated_at: new Date().toISOString() })
        .eq("id", id).eq("state", "preparing").eq("updated_at", campaign.updated_at).select("*").maybeSingle();
      if (saved.error || !saved.data) throw new Error("Could not save the prepared email. Nothing has been sent.");
      campaign = saved.data;
    } catch (error) {
      await client.from(table).update({ state: "draft", last_error: "Preparation failed. Nothing has been sent.", updated_at: new Date().toISOString() })
        .eq("id", id).eq("state", "preparing").eq("updated_at", campaign.updated_at);
      throw error;
    }
  }
  const claimed = await client.from(table).update({ state: "sending", send_requested_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null })
    .eq("id", id).eq("state", "ready").eq("updated_at", campaign.updated_at).select("*").maybeSingle();
  if (claimed.error || !claimed.data) throw new Error(changed);
  try {
    await sendMailingBroadcast(claimed.data.resend_broadcast_id!);
    const saved = await client.from(table).update({ state: "submitted", updated_at: new Date().toISOString() }).eq("id", id).eq("state", "sending");
    if (saved.error) throw new Error("The delivery status could not be saved.");
  } catch {
    // A timeout can mean accepted. Never resend automatically or create another
    // broadcast: refresh retrieves this exact broadcast's authoritative status.
    const message = "Delivery needs checking. Refresh the status; do not create another copy to retry this send.";
    await client.from(table).update({ last_error: message }).eq("id", id).eq("state", "sending");
    throw new Error(message);
  }
}

export async function refreshMailingCampaign(client: Client, campaign: MailingCampaign) {
  if (campaign.resend_broadcast_id) {
    const remote = await getMailingBroadcast(campaign.resend_broadcast_id);
    if (["queued", "scheduled", "sending", "sent"].includes(remote.status)) {
      const result = await client.from(table).update({ state: "submitted", last_error: null, updated_at: new Date().toISOString() })
        .eq("id", campaign.id).eq("updated_at", campaign.updated_at);
      if (result.error) throw new Error("Could not update the delivery status.");
    }
    // An ambiguous send stays locked even if the remote status is still draft.
    // The operator can inspect/send the existing draft in Resend, then refresh.
    return remote.status;
  }
  if (campaign.state === "preparing" && Date.now() - Date.parse(campaign.updated_at) > 120000) {
    const result = await client.from(table).update({ state: "draft", updated_at: new Date().toISOString(), last_error: "Preparation was interrupted. You can try again; nothing was sent." })
      .eq("id", campaign.id).eq("state", "preparing").eq("updated_at", campaign.updated_at);
    if (result.error) throw new Error("Could not recover this draft.");
  }
  return null;
}
