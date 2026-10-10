import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { CampaignContent } from "../../mailing-list";

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
