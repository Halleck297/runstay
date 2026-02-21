import fs from "node:fs";
import path from "node:path";

const I18N_PATH = path.join(process.cwd(), "app", "lib", "i18n.ts");
const API_URL = "https://translation.googleapis.com/language/translate/v2";
const API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;

const DEFAULT_LOCALES = ["it", "es", "fr", "de", "nl", "pt"];
const BATCH_SIZE = 80;

if (!API_KEY) {
  console.error("Missing GOOGLE_TRANSLATE_API_KEY");
  process.exit(1);
}

function parseArgs() {
  const arg = process.argv.find((v) => v.startsWith("--locales="));
  if (!arg) return DEFAULT_LOCALES;
  const locales = arg
    .slice("--locales=".length)
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return locales.length > 0 ? locales : DEFAULT_LOCALES;
}

function extractBlock(source, lang) {
  const re = new RegExp(
    `const\\s+${lang}\\s*:\\s*Partial<Record<TranslationKey, string>>\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`
  );
  const m = source.match(re);
  if (!m) return null;
  return { body: m[1], regex: re };
}

function parseMap(body) {
  const map = new Map();
  for (const m of body.matchAll(/^\s*"([^"]+)":\s*"([\s\S]*?)",\s*$/gm)) {
    map.set(m[1], m[2]);
  }
  return map;
}

function escapeValue(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function maskPlaceholders(text) {
  const tokens = [];
  const masked = text.replace(/(\{[^}]+\}|\$\{[^}]+\}|%[sd])/g, (m) => {
    const t = `__PH_${tokens.length}__`;
    tokens.push(m);
    return t;
  });
  return { masked, tokens };
}

function unmaskPlaceholders(text, tokens) {
  return tokens.reduce((acc, t, i) => acc.replaceAll(`__PH_${i}__`, t), text);
}

async function translateBatch(lines, target) {
  const payload = new URLSearchParams({
    key: API_KEY,
    target,
    format: "text",
  });
  for (const line of lines) payload.append("q", line);

  const res = await fetch(API_URL, { method: "POST", body: payload });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Translate API error (${target}): ${res.status} ${err}`);
  }
  const json = await res.json();
  return (json.data?.translations || []).map((t) => t.translatedText || "");
}

async function main() {
  const locales = parseArgs();
  let source = fs.readFileSync(I18N_PATH, "utf8");

  const enBlock = source.match(/const\s+en\s*:\s*Record<TranslationKey,\s*string>\s*=\s*\{([\s\S]*?)\n\};/);
  if (!enBlock) throw new Error("EN block not found");

  const enMap = parseMap(enBlock[1]);
  const enKeys = [...enMap.keys()];

  for (const locale of locales) {
    const block = extractBlock(source, locale);
    if (!block) {
      console.warn(`Skipping unknown locale block: ${locale}`);
      continue;
    }

    const localeMap = parseMap(block.body);
    const todo = [];

    for (const key of enKeys) {
      const enValue = enMap.get(key) || "";
      const current = localeMap.get(key);

      // Translate when missing/empty or still identical to EN.
      if (current == null || current === "" || current === enValue) {
        todo.push({ key, text: enValue });
      }
    }

    if (todo.length === 0) {
      console.log(`${locale}: nothing to translate`);
      continue;
    }

    console.log(`${locale}: translating ${todo.length} keys...`);
    for (let i = 0; i < todo.length; i += BATCH_SIZE) {
      const chunk = todo.slice(i, i + BATCH_SIZE);
      const masked = chunk.map((item) => maskPlaceholders(item.text));
      const translated = await translateBatch(
        masked.map((m) => m.masked),
        locale
      );

      translated.forEach((value, idx) => {
        const raw = value || chunk[idx].text;
        const finalValue = unmaskPlaceholders(raw, masked[idx].tokens);
        localeMap.set(chunk[idx].key, finalValue);
      });
    }

    const rebuiltBody = enKeys
      .map((key) => `  "${key}": "${escapeValue(localeMap.get(key) || enMap.get(key) || "")}",`)
      .join("\n");

    source = source.replace(
      block.regex,
      `const ${locale}: Partial<Record<TranslationKey, string>> = {\n${rebuiltBody}\n};`
    );
  }

  fs.writeFileSync(I18N_PATH, source);
  console.log("i18n auto-translation completed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
