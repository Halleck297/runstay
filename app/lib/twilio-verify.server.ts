const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

function getTwilioConfig() {
  if (!accountSid || !authToken || !verifyServiceSid) {
    throw new Error("Twilio Verify env vars are missing");
  }
  return { accountSid, authToken, verifyServiceSid };
}

async function callTwilioVerify(
  path: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const cfg = getTwilioConfig();
  const body = new URLSearchParams(params);
  const authHeader = `Basic ${Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64")}`;
  const response = await fetch(`https://verify.twilio.com/v2/Services/${cfg.verifyServiceSid}/${path}`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof payload.message === "string" ? payload.message : "Twilio Verify request failed";
    throw new Error(message);
  }
  return payload;
}

export async function startPhoneVerification(phoneE164: string): Promise<void> {
  await callTwilioVerify("Verifications", {
    To: phoneE164,
    Channel: "sms",
  });
}

export async function checkPhoneVerificationCode(phoneE164: string, code: string): Promise<boolean> {
  const payload = await callTwilioVerify("VerificationCheck", {
    To: phoneE164,
    Code: code,
  });
  return payload.status === "approved";
}
