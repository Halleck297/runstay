import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { CampaignContent } from "../../mailing-list";

export type MailingConfirmationPayload = { confirmUrl: string };
export function renderMailingConfirmation(payload: MailingConfirmationPayload) {
  const subject = "Confirm your subscription to Runoot Last Minute";
  const explanation = "Confirm that you want email updates about bibs, hotels, race packages and last-minute opportunities across all races and destinations. You can unsubscribe at any time.";
  const note = "This link expires in 72 hours. If you didn’t request this, simply ignore this email. Your race requests are separate.";
  return {
    subject,
    html: renderBaseEmailLayout({ locale: "en", title: "Confirm your subscription", bodyHtml: `<p>${explanation}</p><p style="color:#627083;font-size:13px">${note}</p>`, ctaLabel: "Confirm my subscription", ctaUrl: payload.confirmUrl, footerText: "You received this email because someone requested to subscribe this address to Runoot Last Minute." }),
    text: `${explanation}\n\nConfirm your subscription: ${payload.confirmUrl}\n\n${note}`,
  };
}

export function renderMailingCampaign(content: CampaignContent, preview = false) {
  const unsubscribe = preview ? "#unsubscribe-preview" : "{{{RESEND_UNSUBSCRIBE_URL}}}";
  const html = renderBaseEmailLayout({
    locale: "en", title: content.subject,
    bodyHtml: `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(content.preview_text)}</div><div style="text-align:left;overflow-wrap:anywhere">${content.body.split(/\n\s*\n/).map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`).join("")}</div>`,
    ctaLabel: content.button_label, ctaUrl: content.button_url,
    footerText: "You subscribed to Runoot Last Minute: bibs, hotels, race packages and last-minute opportunities.",
  }).replace("</body>", `<p style="text-align:center;font:12px Arial;color:#627083"><a href="${unsubscribe}" style="color:#627083">Unsubscribe from Runoot Last Minute</a> · <a href="https://www.runoot.com/privacy-policy" style="color:#627083">Privacy</a><br />Runoot · Italy · support@runoot.com</p></body>`);
  return { subject: content.subject, html, text: `${content.body}${content.button_url ? `\n\n${content.button_label}: ${content.button_url}` : ""}\n\nUnsubscribe from Runoot Last Minute: ${unsubscribe}\nRunoot · Italy · support@runoot.com` };
}
