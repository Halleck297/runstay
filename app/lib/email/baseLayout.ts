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
  footerText?: string;
}

export function renderBaseEmailLayout(args: BaseLayoutArgs): string {
  const title = escapeHtml(args.title);
  const intro = args.intro ? `<p style=\"margin:0 0 14px;color:#374151;\">${escapeHtml(args.intro)}</p>` : "";
  const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
  const logoUrl = appUrl ? `${appUrl}/logo.svg` : "/logo.svg";
  const inlineLogo = `<img src=\"${escapeHtml(logoUrl)}\" alt=\"Runoot\" width=\"180\" style=\"display:block;height:auto;border:0;outline:none;text-decoration:none;\" />`;
  const cta = args.ctaLabel && args.ctaUrl
    ? `<p style=\"margin:20px 0 0;\"><a href=\"${escapeHtml(args.ctaUrl)}\" style=\"background:#ff6b35;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:9999px;display:inline-block;font-weight:600;\">${escapeHtml(args.ctaLabel)}</a></p>`
    : "";
  const footerText = escapeHtml(args.footerText || footerByLocale[args.locale]);

  return `
    <div style="background:#f9fafb;padding:24px 12px;font-family:Arial,sans-serif;line-height:1.5;color:#111827;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="padding:18px 20px;border-bottom:1px solid #f3f4f6;">
          ${inlineLogo}
        </div>
        <div style="padding:20px;">
          <h2 style="margin:0 0 12px;color:#111827;">${title}</h2>
          ${intro}
          ${args.bodyHtml}
          ${cta}
        </div>
        <div style="padding:14px 20px;border-top:1px solid #f3f4f6;background:#fafafa;">
          <p style="margin:0;color:#6b7280;font-size:12px;">${footerText}</p>
        </div>
      </div>
    </div>
  `.trim();
}
