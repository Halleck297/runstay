import assert from "node:assert/strict";
import type { ActionFunctionArgs } from "react-router";

// Fake credentials and intercepted network calls: no real offers or messages are created.
process.env.SUPABASE_URL = "https://bib-offer-alert-test.invalid";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.TELEGRAM_BOT_TOKEN = "test-telegram-token";
process.env.TELEGRAM_CHAT_ID = "test-chat";
const originalFetch = globalThis.fetch;
const originalError = console.error;
const originalWarn = console.warn;
const offers: Record<string, unknown>[] = [];
const messages: { chat_id: string; text: string }[] = [];
const events: string[] = [];
let saveFailure = false;
let telegramMode: "ok" | "rejected" | "network" | "timeout" | "pending" = "ok";
let releaseTelegram: () => void = () => {};
let telegramStarted: () => void = () => {};
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  if (url.hostname === "bib-offer-alert-test.invalid" && url.pathname === "/rest/v1/bib_offers") {
    assert.equal(init?.method, "POST");
    events.push("save");
    if (saveFailure) return Response.json({ code: "test", message: "Save failed" }, { status: 503 });
    offers.push(JSON.parse(String(init?.body)));
    return new Response(null, { status: 201 });
  }
  if (url.hostname === "api.telegram.org" && url.pathname === "/bottest-telegram-token/sendMessage") {
    assert.equal(events.at(-1), "save", "Every alert must follow its database save");
    events.push("telegram");
    messages.push(JSON.parse(String(init?.body)));
    if (telegramMode === "network") throw new Error("Test network failure");
    if (telegramMode === "timeout") throw new DOMException("Test timeout", "TimeoutError");
    if (telegramMode === "pending") {
      await new Promise<void>(resolve => { releaseTelegram = resolve; telegramStarted(); });
    }
    return Response.json({ ok: telegramMode !== "rejected" }, { status: telegramMode === "rejected" ? 503 : 200 });
  }
  throw new Error(`Unexpected test request: ${url.origin}${url.pathname}`);
};
console.error = () => {};
console.warn = () => {};

try {
  const { submitBibOffer } = await import("../app/lib/bib-offers.server");
  async function submit(overrides: Record<string, string> = {}, origin = "https://www.runoot.com") {
    const body = new FormData();
    const values = { firstName: "Test", lastName: "Runner", email: "offer@example.com", phone: "+44 7700 900123", race: "Trail <Run> & Fun", raceDate: "2027-06-10", entryType: "bib", price: "150,50", currency: "EUR", deadline: "2027-06-01", notes: "Private seller notes", consent: "on", ...overrides };
    for (const [key, value] of Object.entries(values)) body.set(key, value);
    return (await submitBibOffer({ request: new Request("https://www.runoot.com/offer-entry", { method: "POST", headers: { origin }, body }), params: {}, context: {} } as ActionFunctionArgs)).data;
  }

  const invalidSubmissions: Record<string, string>[] = [{ email: "invalid" }, { consent: "" }, { website: "spam" }];
  for (const invalid of invalidSubmissions) {
    assert.equal((await submit(invalid)).success, false);
  }
  assert.equal((await submit({}, "https://untrusted.invalid")).success, false);
  assert.equal(events.length, 0, "Invalid submissions must not save or notify");

  saveFailure = true;
  assert.equal((await submit()).success, false);
  assert.equal(messages.length, 0, "Failed saves must not notify");
  saveFailure = false;

  assert.equal((await submit()).success, true);
  assert.equal(offers.length, 1);
  assert.equal(messages.length, 1, "One saved offer produces one alert");
  assert.equal(messages[0].chat_id, "test-chat");
  assert.ok(messages[0].text.startsWith("<b>[Runoot]</b>"));
  for (const content of ["Nuova offerta", "Trail &lt;Run&gt; &amp; Fun", "10/06/2027", "Solo pettorale", "150.50 EUR", "01/06/2027", "/admin/bib-offers"]) {
    assert.ok(messages[0].text.includes(content), content);
  }
  for (const privateValue of ["offer@example.com", "+44 7700 900123", "Private seller notes", "Test Runner"]) {
    assert.ok(!messages[0].text.includes(privateValue), "Personal details stay in the admin dashboard");
  }

  assert.equal((await submit({ price: "0", entryType: "package" })).success, true);
  assert.ok(messages.at(-1)?.text.includes("0.00 EUR"));
  assert.ok(messages.at(-1)?.text.includes("Pacchetto completo"));
  assert.equal((await submit({ price: "", deadline: "" })).success, true);
  assert.ok(messages.at(-1)?.text.includes("Non indicato"));
  assert.ok(!messages.at(-1)?.text.includes("Scadenza trasferimento"));

  for (const failure of ["rejected", "network", "timeout"] as const) {
    telegramMode = failure;
    const savedBefore: number = offers.length;
    const alertsBefore: number = messages.length;
    assert.equal((await submit()).success, true, "Telegram failures must not fail a saved offer");
    assert.equal(offers.length, savedBefore + 1);
    assert.equal(messages.length, alertsBefore + 1);
  }

  delete process.env.TELEGRAM_BOT_TOKEN;
  const alertsBefore = messages.length;
  assert.equal((await submit()).success, true);
  assert.equal(messages.length, alertsBefore, "Missing configuration must not call Telegram");

  process.env.TELEGRAM_BOT_TOKEN = "test-telegram-token";
  telegramMode = "pending";
  const started = new Promise<void>(resolve => { telegramStarted = resolve; });
  let finished = false;
  const pending = submit().then(result => { finished = true; return result; });
  await started;
  assert.equal(finished, false, "The form response must wait for Telegram in a serverless environment");
  releaseTelegram();
  assert.equal((await pending).success, true);
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalError;
  console.warn = originalWarn;
}
console.log("Bib offer alerts: saved offers, Runoot label, escaping, prices, validation, failure isolation and awaited delivery passed. No real messages sent.");
