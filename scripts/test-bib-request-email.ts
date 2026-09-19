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

// All credentials and network responses below are fake. No real mail is sent.
process.env.SUPABASE_URL = "https://bib-request-email-test.invalid";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.RESEND_API_KEY = "test-email-key";
process.env.RESEND_FROM_EMAIL = "Runoot <test@example.com>";
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
type SavedRequest = { email: string; race: string; race_key: string; preference: string };
const records: SavedRequest[] = [];
const emails: { to: string[]; subject: string; html: string; text: string }[] = [];
const loggedErrors: { template_id: string; recipient: string }[] = [];
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
    assert.equal(url.searchParams.get("select"), "race,race_key");
    const values = JSON.parse(String(init?.body)) as SavedRequest[];
    const inserted = values.filter(value => !records.some(row => row.email === value.email && row.race_key === value.race_key));
    records.push(...inserted);
    return new Response(JSON.stringify(inserted.map(({ race, race_key }) => ({ race, race_key }))), { status: 201, headers: { "Content-Type": "application/json" } });
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
  throw new Error(`Unexpected test network request: ${url.origin}${url.pathname}`);
};
console.error = () => {};

try {
  const { submitBibRequest } = await import("../app/lib/bib-requests.server");
  async function submit(overrides: Record<string, string | string[]> = {}, path = "/go", origin = "https://www.runoot.com") {
    const body = new FormData();
    const values = { firstName: "Alex", lastName: "Runner", email: " ALEX@EXAMPLE.COM ", race: ["Tokyo", "New York"], preference: "package", consent: "on", ...overrides };
    for (const [key, value] of Object.entries(values)) {
      for (const item of Array.isArray(value) ? value : [value]) body.append(key, item);
    }
    return (await submitBibRequest({ request: new Request(`https://www.runoot.com${path}`, { method: "POST", headers: { origin }, body }), params: {}, context: {} } as ActionFunctionArgs)).data;
  }

  assert.equal((await submit({ consent: "" })).success, false);
  assert.equal((await submit({ website: "spam" })).success, false);
  assert.equal((await submit({}, "/go", "https://untrusted.invalid")).success, false);
  assert.equal(saveAttempts, 0);
  assert.equal(emails.length, 0);

  saveFailure = true;
  assert.equal((await submit()).success, false);
  assert.equal(emails.length, 0, "Failed saves must not send a confirmation");
  saveFailure = false;

  const success = await submit();
  assert.equal(success.success, true);
  assert.ok(success.success && success.confirmationEmail === "sent");
  assert.equal(emails.length, 1, "Multiple races produce one email");
  assert.deepEqual(emails[0].to, ["alex@example.com"]);
  assert.ok(emails[0].text.includes("Tokyo") && emails[0].text.includes("New York"));
  assert.ok(emails[0].text.includes("Full package (bib + hotel)"));

  const duplicate = await submit({ preference: "bib" }, "/");
  assert.ok(duplicate.success && duplicate.confirmationEmail === "not_needed");
  assert.equal(emails.length, 1, "Duplicate requests do not resend or misrepresent stored preferences");
  assert.ok(records.every(row => row.preference === "package"));

  const mixed = await submit({ race: ["Tokyo", "London"], preference: ["bib", "package"] }, "/en");
  assert.ok(mixed.success && mixed.confirmationEmail === "sent");
  assert.equal(emails.length, 2);
  assert.ok(emails[1].text.includes("London"));
  assert.ok(!emails[1].text.includes("Tokyo"), "The email summarizes only newly saved races");
  assert.ok(emails[1].text.includes("Bib only or full package"));

  const single = await submit({ race: "Cardiff", preference: "bib" }, "/");
  assert.ok(single.success && single.confirmationEmail === "sent");
  assert.ok(emails[2].text.includes("You’re looking for: Bib only"));

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
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
}
console.log("Bib confirmation email: template escaping, one email per save, deduplication, validation and failure isolation passed. No real emails sent.");
