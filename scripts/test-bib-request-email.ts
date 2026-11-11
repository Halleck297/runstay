import assert from "node:assert/strict";
import type { ActionFunctionArgs } from "react-router";
import { renderEmailTemplate } from "../app/lib/email/registry";

const template = (preference: "bib" | "package" | "both") => renderEmailTemplate({
  templateId: "bib_request_confirmation",
  locale: "en",
  payload: { firstName: "Alex <script>alert(1)</script>", races: ["Tokyo", "Trail <img src=x onerror=alert(1)> & Run"], preference },
});
for (const preference of ["bib", "package", "both"] as const) {
  const rendered = template(preference);
  assert.ok(rendered.subject.includes("BibExchange"));
  assert.ok(rendered.html.includes("Tokyo"));
  assert.ok(rendered.html.includes("&lt;script&gt;"));
  assert.ok(rendered.html.includes("&lt;img"));
  assert.ok(!rendered.html.includes("<script>"));
  assert.ok(!rendered.html.includes("<img"));
  assert.ok(rendered.text.includes("support@runoot.com"));
  assert.ok(rendered.text.includes("does not reserve or guarantee"));
  const expected = preference === "both" ? "Bib only or full package (bib + hotel)" : preference === "package" ? "Full package (bib + hotel)" : "Bib only";
  assert.ok(rendered.html.includes(expected));
  assert.ok(rendered.text.includes(expected));
}

// All credentials and network responses below are fake. No real mail or Telegram messages are sent.
process.env.SUPABASE_URL = "https://bib-request-email-test.invalid";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.RESEND_API_KEY = "test-email-key";
process.env.RESEND_FROM_EMAIL = "Runoot <test@example.com>";
process.env.TELEGRAM_BOT_TOKEN = "test-telegram-token";
process.env.TELEGRAM_CHAT_ID = "test-chat";
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
type SavedRequest = { email: string; race: string; race_key: string; preference: string };
const records: SavedRequest[] = [];
const emails: { to: string[]; subject: string; html: string; text: string }[] = [];
const loggedErrors: { template_id: string; recipient: string }[] = [];
const telegramMessages: { chat_id: string; text: string; parse_mode: string }[] = [];
let telegramFailure: "none" | "rejected" | "network" = "none";
let saveFailure = false;
let emailFailure = false;
let logFailure = false;
let saveAttempts = 0;
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  if (url.hostname === "bib-request-email-test.invalid" && url.pathname === "/rest/v1/bib_requests") {
    saveAttempts++;
    if (saveFailure) return new Response(JSON.stringify({ code: "test", message: "Save failed" }), { status: 503 });
    assert.equal(init?.method, "POST");
    const values = JSON.parse(String(init?.body)) as SavedRequest[];
    for (const value of values) {
      const existing = records.find(row => row.email === value.email && row.race_key === value.race_key);
      if (existing) Object.assign(existing, value);
      else records.push(value);
    }
    return new Response(null, { status: 204 });
  }
  if (url.hostname === "api.resend.com" && url.pathname === "/emails") {
    assert.ok(records.length, "The email must only be sent after saving the request");
    emails.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify(emailFailure ? { message: "Test rejection" } : { id: "test-provider-id" }), { status: emailFailure ? 503 : 200 });
  }
  if (url.hostname === "bib-request-email-test.invalid" && url.pathname === "/rest/v1/email_logs") {
    loggedErrors.push(JSON.parse(String(init?.body)));
    if (logFailure) throw new Error("Test logging failure");
    return new Response(null, { status: 201 });
  }
  if (url.hostname === "api.telegram.org" && url.pathname === "/bottest-telegram-token/sendMessage") {
    assert.ok(records.length, "Telegram is only notified after the request has been saved");
    telegramMessages.push(JSON.parse(String(init?.body)));
    if (telegramFailure === "network") throw new Error("Test network failure");
    return Response.json({ ok: telegramFailure !== "rejected" }, { status: telegramFailure === "rejected" ? 503 : 200 });
  }
  throw new Error(`Unexpected test network request: ${url.origin}${url.pathname}`);
};
console.error = () => {};

try {
  const { submitBibRequest } = await import("../app/lib/bib-requests.server");
  async function submit(overrides: Record<string, string | string[]> = {}, path = "/go", origin = "https://www.runoot.com") {
    const body = new FormData();
    const values = { firstName: "Alex", lastName: "Runner", email: " ALEX@EXAMPLE.COM ", race: ["Tokyo", "New York"], preference: "package", ...overrides };
    for (const [key, value] of Object.entries(values)) {
      for (const item of Array.isArray(value) ? value : [value]) body.append(key, item);
    }
    return (await submitBibRequest({ request: new Request(`https://www.runoot.com${path}`, { method: "POST", headers: { origin }, body }), params: {}, context: {} } as ActionFunctionArgs)).data;
  }

  assert.equal((await submit({ email: "invalid" })).success, false);
  assert.equal((await submit({ website: "spam" })).success, false);
  assert.equal((await submit({}, "/go", "https://untrusted.invalid")).success, false);
  assert.equal(saveAttempts, 0);
  assert.equal(emails.length, 0);
  assert.equal(telegramMessages.length, 0, "Invalid submissions must not send alerts");

  saveFailure = true;
  assert.equal((await submit()).success, false);
  assert.equal(emails.length, 0, "Failed saves must not send a confirmation");
  assert.equal(telegramMessages.length, 0, "Failed saves must not send alerts");
  saveFailure = false;

  const success = await submit();
  assert.equal(success.success, true);
  assert.ok(success.success && success.confirmationEmail === "sent");
  assert.equal(emails.length, 1, "Multiple races produce one email");
  assert.deepEqual(emails[0].to, ["alex@example.com"]);
  assert.ok(emails[0].text.includes("Tokyo") && emails[0].text.includes("New York"));
  assert.ok(emails[0].text.includes("Full package (bib + hotel)"));
  assert.equal(telegramMessages.length, 1, "Multiple races produce one Telegram alert");
  assert.equal(telegramMessages[0].chat_id, "test-chat");
  assert.ok(telegramMessages[0].text.startsWith("<b>[Runoot]</b>"));
  assert.ok(telegramMessages[0].text.includes("Tokyo, New York"));
  assert.ok(telegramMessages[0].text.includes("QR (/go)"));
  assert.ok(telegramMessages[0].text.includes("/admin/bib-requests"));
  assert.ok(!telegramMessages[0].text.includes("alex@example.com"), "Contact details stay in the admin dashboard");

  const duplicate = await submit({ preference: "bib" }, "/");
  assert.ok(duplicate.success && duplicate.confirmationEmail === "sent");
  assert.equal(emails.length, 2, "Repeating a request sends a new confirmation");
  assert.ok(emails[1].text.includes("Tokyo") && emails[1].text.includes("New York"));
  assert.ok(emails[1].text.includes("You’re looking for: Bib only"));
  assert.ok(records.every(row => row.preference === "bib"), "Saved preferences match the latest confirmation");
  assert.equal(telegramMessages.length, 2, "A repeated saved submission generates one new alert");
  assert.ok(telegramMessages[1].text.includes("Solo pettorale"));
  assert.ok(telegramMessages[1].text.includes("<b>Origine:</b> Sito"));

  const mixed = await submit({ race: ["Tokyo", "London"], preference: ["bib", "package"] }, "/en");
  assert.ok(mixed.success && mixed.confirmationEmail === "sent");
  assert.equal(emails.length, 3);
  assert.ok(emails[2].text.includes("London") && emails[2].text.includes("Tokyo"), "The email summarizes every selected race");
  assert.ok(emails[2].text.includes("Bib only or full package"));

  const single = await submit({ race: "Cardiff", preference: "bib" }, "/");
  assert.ok(single.success && single.confirmationEmail === "sent");
  assert.ok(emails[3].text.includes("You’re looking for: Bib only"));

  emailFailure = true;
  const failed = await submit({ race: "Chicago" });
  assert.ok(failed.success && failed.confirmationEmail === "failed", "Email rejection must not fail a saved submission");
  assert.ok(records.some(row => row.race === "Chicago"));
  assert.equal(loggedErrors[0].template_id, "bib_request_confirmation");
  assert.equal(loggedErrors[0].recipient, "alex@example.com");

  logFailure = true;
  const failedLog = await submit({ race: "Sydney" });
  assert.ok(failedLog.success && failedLog.confirmationEmail === "failed");
  assert.ok(records.some(row => row.race === "Sydney"));
  logFailure = false;
  emailFailure = false;

  delete process.env.RESEND_API_KEY;
  const beforeMissingConfig = emails.length;
  const missingConfig = await submit({ race: "Cape Town" });
  assert.ok(missingConfig.success && missingConfig.confirmationEmail === "failed");
  assert.equal(emails.length, beforeMissingConfig, "Missing config does not make a provider call");
  assert.ok(telegramMessages.at(-1)?.text.includes("Cape Town"), "Email configuration does not block Telegram alerts");

  process.env.RESEND_API_KEY = "test-email-key";
  for (const failure of ["rejected", "network"] as const) {
    telegramFailure = failure;
    const result = await submit({ race: "Tokyo" });
    assert.ok(result.success && result.confirmationEmail === "sent", "Telegram failures must not fail a saved request or its email");
  }
  telegramFailure = "none";
  const custom = await submit({ race: "Another race", otherRace: "Trail <Run> & Fun" });
  assert.ok(custom.success);
  assert.ok(telegramMessages.at(-1)?.text.includes("Trail &lt;Run&gt; &amp; Fun"));
  assert.ok(!telegramMessages.at(-1)?.text.includes("Trail <Run>"));
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
}
console.log("Bib notifications: email and Telegram after save, one alert per submission, project label, escaping, validation and independent failure handling passed. No real messages sent.");
