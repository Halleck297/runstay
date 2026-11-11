import assert from "node:assert/strict";
import { escapeTelegramHtml, sendTelegram } from "../app/lib/telegram.server";

// All credentials are fake, and every network call is intercepted.
const originalFetch = globalThis.fetch;
const originalError = console.error;
const originalWarn = console.warn;
const originalToken = process.env.TELEGRAM_BOT_TOKEN;
const originalChat = process.env.TELEGRAM_CHAT_ID;
const requests: { chat_id: string; text: string; parse_mode: string }[] = [];
const logs: unknown[][] = [];
let response: () => Response = () => Response.json({ ok: true });
globalThis.fetch = async (input, init) => {
  assert.equal(String(input), "https://api.telegram.org/botfake-secret/sendMessage");
  assert.equal(init?.method, "POST");
  assert.ok(init?.signal instanceof AbortSignal, "Telegram requests must be bounded by a timeout");
  requests.push(JSON.parse(String(init?.body)));
  return response();
};
console.error = (...args) => { logs.push(args); };
console.warn = (...args) => { logs.push(args); };

try {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  assert.equal(await sendTelegram("Missing configuration"), false);
  assert.equal(requests.length, 0);
  process.env.TELEGRAM_BOT_TOKEN = "  fake-secret\n";
  process.env.TELEGRAM_CHAT_ID = "  test-chat\n";
  assert.equal(await sendTelegram("<b>Test</b>"), true);
  assert.equal(requests[0].chat_id, "test-chat");
  assert.equal(requests[0].text, "<b>[Runoot]</b>\n<b>Test</b>");
  assert.equal(requests[0].parse_mode, "HTML");
  assert.equal(escapeTelegramHtml('<run> & "race"'), "&lt;run&gt; &amp; &quot;race&quot;");

  response = () => Response.json({ ok: false, error_code: 429, description: "fake-secret" }, { status: 429 });
  assert.equal(await sendTelegram("Rate limited"), false);
  assert.equal(requests.length, 2, "Failed sends are not blindly retried");
  response = () => Response.json({ ok: false });
  assert.equal(await sendTelegram("Rejected despite HTTP 200"), false);
  response = () => new Response("Invalid response");
  assert.equal(await sendTelegram("Bad response"), false);
  response = () => { throw new Error("Network error for botfake-secret"); };
  assert.equal(await sendTelegram("Network failure"), false);
  response = () => { throw new DOMException("Timed out", "TimeoutError"); };
  assert.equal(await sendTelegram("Timeout"), false);
  assert.ok(!JSON.stringify(logs).includes("fake-secret"), "Logs must never contain the bot token or raw provider errors");
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalError;
  console.warn = originalWarn;
  if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = originalToken;
  if (originalChat === undefined) delete process.env.TELEGRAM_CHAT_ID;
  else process.env.TELEGRAM_CHAT_ID = originalChat;
}
console.log("Telegram: project label, configuration, timeout signal, provider failures and safe logging passed. No real messages sent.");
