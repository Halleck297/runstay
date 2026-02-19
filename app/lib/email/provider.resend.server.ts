export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  ok: boolean;
  providerId?: string;
  error?: string;
}

export async function sendWithResend(input: SendEmailInput): Promise<SendEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!resendApiKey || !fromEmail) {
    return {
      ok: false,
      error: "Email sending is not configured yet. Missing RESEND_API_KEY or RESEND_FROM_EMAIL.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, error: `Resend error ${response.status}: ${errorText}` };
    }

    const responseJson = await response.json().catch(() => ({}));
    return { ok: true, providerId: responseJson?.id };
  } catch (error: any) {
    return { ok: false, error: error?.message || "Unexpected error while sending email" };
  }
}
