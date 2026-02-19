import { renderEmailTemplate, type EmailTemplatePayloadMap } from "./registry";
import { sendWithResend, type SendEmailResult } from "./provider.resend.server";
import { normalizeEmailLocale, type EmailTemplateId } from "./types";

export async function sendTemplatedEmail<T extends EmailTemplateId>(args: {
  to: string;
  templateId: T;
  payload: EmailTemplatePayloadMap[T];
  locale?: string | null;
}): Promise<SendEmailResult> {
  const locale = normalizeEmailLocale(args.locale);
  const rendered = renderEmailTemplate({
    templateId: args.templateId,
    payload: args.payload,
    locale,
  });

  return sendWithResend({
    to: args.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
}
