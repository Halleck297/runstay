import { renderEmailTemplate, type EmailTemplatePayloadMap } from "./registry";
import { sendWithResend, type SendEmailResult } from "./provider.resend.server";
import { normalizeEmailLocale, type EmailTemplateId } from "./types";
import { supabaseAdmin } from "~/lib/supabase.server";

export async function sendTemplatedEmail<T extends EmailTemplateId>(args: {
  to: string;
  templateId: T;
  payload: EmailTemplatePayloadMap[T];
  locale?: string | null;
  from?: string;
}): Promise<SendEmailResult> {
  const locale = normalizeEmailLocale(args.locale);
  const rendered = renderEmailTemplate({
    templateId: args.templateId,
    payload: args.payload,
    locale,
  });

  const result = await sendWithResend({
    to: args.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    from: args.from,
  });

  if (!result.ok) {
    console.error(`[email] Failed to send "${args.templateId}" to ${args.to}: ${result.error}`);
    await supabaseAdmin.from("email_logs" as any).insert({
      template_id: args.templateId,
      recipient: args.to,
      error: result.error ?? "Unknown error",
    });
  }

  return result;
}
