import fs from "node:fs";
import path from "node:path";

const I18N_PATH = path.join(process.cwd(), "app", "lib", "i18n.ts");
const APP_DIR = path.join(process.cwd(), "app");

function getBlock(source, lang, fullEn = false) {
  const re = fullEn
    ? /const\s+en\s*:\s*Record<TranslationKey,\s*string>\s*=\s*\{([\s\S]*?)\n\};/
    : new RegExp(
        `const\\s+${lang}\\s*:\\s*Partial<Record<TranslationKey, string>>\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`
      );
  const m = source.match(re);
  if (!m) return new Map();
  const map = new Map();
  for (const mm of m[1].matchAll(/^\s*"([^"]+)":\s*"([\s\S]*?)",\s*$/gm)) {
    map.set(mm[1], mm[2]);
  }
  return map;
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "build", ".react-router"].includes(entry.name)) continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !full.endsWith(path.join("lib", "i18n.ts"))) {
      out.push(full);
    }
  }
  return out;
}

function extractUsedKeys(files, enKeys) {
  const used = new Set();
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const m of source.matchAll(/\bt\(\s*["']([^"']+)["']\s*\)/g)) {
      if (enKeys.has(m[1])) used.add(m[1]);
    }
    for (const m of source.matchAll(/\bt\(\s*`([a-z0-9_]+(?:\.[a-z0-9_]+)*)\.\$\{/gi)) {
      const prefix = `${m[1]}.`;
      for (const key of enKeys) {
        if (key.startsWith(prefix)) used.add(key);
      }
    }
  }
  return used;
}

function placeholders(text) {
  return [...text.matchAll(/(\{[^}]+\}|\$\{[^}]+\}|%[sd])/g)]
    .map((m) => m[1])
    .sort()
    .join("|");
}

function coverageForPrefix(keys, map, enMap, prefix) {
  const scoped = [...keys].filter((k) => k.startsWith(prefix));
  const translated = scoped.filter((k) => (map.get(k) ?? enMap.get(k)) !== enMap.get(k));
  return { total: scoped.length, translated: translated.length };
}

function main() {
  const source = fs.readFileSync(I18N_PATH, "utf8");
  const enMap = getBlock(source, "en", true);
  const maps = {
    it: getBlock(source, "it"),
    es: getBlock(source, "es"),
    fr: getBlock(source, "fr"),
    de: getBlock(source, "de"),
    nl: getBlock(source, "nl"),
    pt: getBlock(source, "pt"),
  };

  const enKeys = new Set(enMap.keys());
  const files = walk(APP_DIR).filter((f) => !f.includes(`${path.sep}admin`));
  const used = extractUsedKeys(files, enKeys);

  const mismatch = [];
  const empty = [];
  for (const key of used) {
    const enPh = placeholders(enMap.get(key) ?? "");
    for (const [lang, map] of Object.entries(maps)) {
      const value = map.get(key) ?? enMap.get(key) ?? "";
      if (placeholders(value) !== enPh) mismatch.push(`${lang} ${key}`);
      if (value.trim() === "") empty.push(`${lang} ${key}`);
    }
  }

  const lines = [];
  lines.push(`Used keys (non-admin): ${used.size}`);
  lines.push(`Placeholder mismatches: ${mismatch.length}`);
  lines.push(`Empty values: ${empty.length}`);
  lines.push("");

  for (const [lang, map] of Object.entries(maps)) {
    const sameAsEn = [...used].filter((k) => (map.get(k) ?? enMap.get(k)) === enMap.get(k));
    lines.push(`${lang.toUpperCase()} same as EN on used keys: ${sameAsEn.length}`);
    lines.push(
      `  profile.* translated: ${coverageForPrefix(used, map, enMap, "profile.").translated}/${coverageForPrefix(
        used,
        map,
        enMap,
        "profile."
      ).total}`
    );
    lines.push(
      `  settings.* translated: ${coverageForPrefix(used, map, enMap, "settings.").translated}/${coverageForPrefix(
        used,
        map,
        enMap,
        "settings."
      ).total}`
    );
    lines.push(
      `  dashboard.* translated: ${coverageForPrefix(used, map, enMap, "dashboard.").translated}/${coverageForPrefix(
        used,
        map,
        enMap,
        "dashboard."
      ).total}`
    );
    lines.push("");
  }

  fs.mkdirSync(path.join(process.cwd(), "reports"), { recursive: true });
  const reportPath = path.join(process.cwd(), "reports", "i18n-audit.txt");
  fs.writeFileSync(reportPath, lines.join("\n"));
  console.log(`Wrote ${reportPath}`);
}

main();
