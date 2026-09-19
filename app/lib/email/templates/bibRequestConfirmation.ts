import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { RenderedEmailTemplate } from "../types";

export interface BibRequestConfirmationPayload {
  firstName: string;
  races: string[];
  preference: "bib" | "package" | "both";
}

// The BibExchange landing and its confirmation emails are currently English-only.
export function renderBibRequestConfirmationTemplate(payload: BibRequestConfirmationPayload): RenderedEmailTemplate {
  const preference = payload.preference === "both"
    ? "Bib only or full package (bib + hotel)"
    : payload.preference === "package" ? "Full package (bib + hotel)" : "Bib only";
  const nextStep = "We’ll contact you by email when a matching opportunity becomes available. You’ll receive the price and conditions before deciding whether to go ahead.";
  const note = "Your request is free. It does not reserve or guarantee a race entry, and there is nothing to pay now.";
  const footer = "You received this confirmation because a request was submitted with your email address on BibExchange by Runoot.";
  return {
    subject: "We’ve received your race request | BibExchange by Runoot",
    html: renderBaseEmailLayout({
      locale: "en",
      title: "Your next start line. One step closer.",
      bodyHtml: `
        <p style="margin:0 0 16px;color:#374151;">Hi ${escapeHtml(payload.firstName)},</p>
        <p style="margin:0 0 24px;color:#374151;">Thanks for your request. You’re on the BibExchange list for:</p>
        <div style="margin:0 0 24px;padding:20px;background:#ECF4FE;border-radius:16px;text-align:left;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:1px;color:#0C78F3;">YOUR ${payload.races.length === 1 ? "RACE" : "RACES"}</p>
          <ul style="margin:0 0 18px;padding-left:20px;color:#111827;">${payload.races.map(race => `<li style="margin:4px 0;overflow-wrap:anywhere;">${escapeHtml(race)}</li>`).join("")}</ul>
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1px;color:#0C78F3;">YOU’RE LOOKING FOR</p>
          <p style="margin:0;color:#111827;">${escapeHtml(preference)}</p>
        </div>
        <p style="margin:0 0 8px;font-weight:700;">What happens next?</p>
        <p style="margin:0 0 20px;color:#374151;">${escapeHtml(nextStep)}</p>
        <p style="margin:0 0 24px;color:#6b7280;font-size:13px;">${escapeHtml(note)}</p>
        <p style="margin:0;color:#374151;font-size:13px;">Need to change or withdraw your request, or didn’t make this request? Contact <a href="mailto:support@runoot.com" style="color:#0C78F3;">support@runoot.com</a>.</p>
        <p style="margin:24px 0 0;color:#374151;">See you at the start line,<br /><strong>BibExchange by Runoot</strong></p>
      `.trim(),
      footerText: footer,
    }),
    text: [
      `Hi ${payload.firstName},`,
      "Thanks for your request. You’re on the BibExchange list for:",
      payload.races.map(race => `- ${race}`).join("\n"),
      `You’re looking for: ${preference}`,
      `What happens next?\n${nextStep}`,
      note,
      "Need to change or withdraw your request, or didn’t make this request? Contact support@runoot.com.",
      "See you at the start line,\nBibExchange by Runoot",
      footer,
    ].join("\n\n"),
  };
}
