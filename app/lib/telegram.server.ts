export function escapeTelegramHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sendTelegram(text: string): Promise<boolean> {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn("[Runoot Telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set, skipping.");
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text: `<b>[Runoot]</b>\n${text}`, parse_mode: "HTML", link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(5000),
    });
    const result = await res.json().catch(() => null);
    if (!res.ok || result?.ok !== true) {
      console.error("[Runoot Telegram] Message rejected", { status: res.status, code: result?.error_code });
      return false;
    }
    return true;
  } catch {
    // Never log the request URL: it contains the bot token.
    console.error("[Runoot Telegram] Message could not be sent (network error or timeout).");
    return false;
  }
}

export function verifyWebhookSecret(request: Request): boolean {
  const secret = request.headers.get("x-webhook-secret");
  return !!process.env.WEBHOOK_SECRET && secret === process.env.WEBHOOK_SECRET;
}
