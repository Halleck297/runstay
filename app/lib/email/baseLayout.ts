import type { EmailLocale } from "./types";

const footerByLocale: Record<EmailLocale, string> = {
  en: "You are receiving this email because of your activity on Runoot.",
  it: "Ricevi questa email per la tua attivita su Runoot.",
  de: "Sie erhalten diese E-Mail aufgrund Ihrer Aktivitaet auf Runoot.",
  fr: "Vous recevez cet e-mail en raison de votre activite sur Runoot.",
  es: "Recibes este correo por tu actividad en Runoot.",
  nl: "Je ontvangt deze e-mail vanwege je activiteit op Runoot.",
  pt: "Voce esta recebendo este e-mail por causa da sua atividade no Runoot.",
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface BaseLayoutArgs {
  locale: EmailLocale;
  title: string;
  intro?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  ctaCompact?: boolean;
  ctaFallbackText?: string;
  footerText?: string;
}

export function renderBaseEmailLayout(args: BaseLayoutArgs): string {
  const currentYear = new Date().getUTCFullYear();
  const title = escapeHtml(args.title);
  const intro = args.intro ? `<p style=\"margin:0 0 20px;color:#374151;\">${escapeHtml(args.intro)}</p>` : "";
  const brandHeader = `
    <div style="line-height:1.05;text-align:center;margin:0 0 14px;">
      <div style="font-size:52px;font-weight:800;letter-spacing:-0.6px;color:#0C78F3;">runoot</div>
      <div style="margin-top:6px;font-size:14px;font-weight:700;letter-spacing:0.3px;color:#FF6B35;">
        CONNECT&nbsp;&bull;&nbsp;EXCHANGE&nbsp;&bull;&nbsp;RUN
      </div>
    </div>
  `.trim();
  const ctaPadding = args.ctaCompact ? "8px 12px" : "10px 16px";
  const ctaFontSize = args.ctaCompact ? "13px" : "14px";
  const cta = args.ctaLabel && args.ctaUrl
    ? `<p style=\"margin:28px 0 0;\"><a href=\"${escapeHtml(args.ctaUrl)}\" style=\"background:#ff6b35;color:#ffffff;text-decoration:none;padding:${ctaPadding};border-radius:9999px;display:inline-block;font-weight:600;font-size:${ctaFontSize};\">${escapeHtml(args.ctaLabel)}</a></p>`
    : "";
  const ctaFallback =
    args.ctaLabel && args.ctaUrl && args.ctaFallbackText
      ? `<p style=\"margin:16px 0 0;color:#6b7280;font-size:12px;\">${escapeHtml(args.ctaFallbackText)}</p><p style=\"margin:8px 0 0;color:#6b7280;font-size:12px;word-break:break-all;\">${escapeHtml(args.ctaUrl)}</p>`
      : "";
  const footerText = escapeHtml(args.footerText || footerByLocale[args.locale]);

  return `
    <!doctype html>
    <html lang="${args.locale}">
      <body style="margin:0;padding:0;background:#ECF4FE;font-family:Arial,sans-serif;line-height:1.7;color:#111827;">
        <div style="margin:0;padding:0;background:#ECF4FE;width:100%;">
          <div style="max-width:560px;margin:0 auto;padding:24px 12px 20px;">
            ${brandHeader}
            <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:28px;overflow:hidden;">
            <div style="padding:36px 32px 32px;text-align:center;">
              <h2 style="margin:10px 0 24px;color:#111827;">${title}</h2>
              ${intro}
              ${args.bodyHtml}
              ${cta}
              ${ctaFallback}
            </div>
            <div style="padding:16px 28px;border-top:1px solid #f3f4f6;background:#fafafa;border-radius:0 0 28px 28px;text-align:center;">
              <p style="margin:0;color:#6b7280;font-size:12px;">${footerText}</p>
            </div>
            </div>
            <p style="margin:12px 0 0;text-align:center;color:#6b7280;font-size:12px;">&copy; ${currentYear} Runoot. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `.trim();
}
