import { escapeHtml, renderBaseEmailLayout } from "../baseLayout";
import type { EmailLocale, RenderedEmailTemplate } from "../types";

export interface PlatformNotificationPayload {
  title: string;
  message: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

export function renderPlatformNotificationTemplate(
  payload: PlatformNotificationPayload,
  locale: EmailLocale
): RenderedEmailTemplate {
  const bodyHtml = `<p style=\"margin:0;color:#374151;\">${escapeHtml(payload.message)}</p>`;

  return {
    subject: payload.title,
    html: renderBaseEmailLayout({
      locale,
      title: payload.title,
      bodyHtml,
      ctaLabel: payload.ctaLabel,
      ctaUrl: payload.ctaUrl,
    }),
    text: [payload.title, payload.message, payload.ctaUrl || null].filter(Boolean).join("\n\n"),
  };
}
