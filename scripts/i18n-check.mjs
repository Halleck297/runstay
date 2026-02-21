import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const appDir = path.join(projectRoot, 'app');
const i18nFile = path.join(appDir, 'lib', 'i18n.ts');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === '.react-router') continue;
      files.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function extractTranslationKeys(source, enKeys) {
  const keys = new Set();
  const directCallRegex = /\bt\(\s*["']([^"']+)["']\s*\)/g;
  let match;
  while ((match = directCallRegex.exec(source))) {
    keys.add(match[1]);
  }

  // Handle common dynamic patterns like: { key: "profile.nav.settings", ... } + t(item.key)
  // We only accept literals that are already valid EN keys to avoid false positives.
  const objectKeyRegex = /\bkey\s*:\s*["']([^"']+)["']/g;
  while ((match = objectKeyRegex.exec(source))) {
    const candidate = match[1];
    if (enKeys.has(candidate)) keys.add(candidate);
  }

  // Catch dynamic references via maps/config objects (e.g. labelKey/titleMap values)
  // by collecting any string literal that equals an EN key.
  const anyStringLiteralRegex = /["']([a-z0-9_]+(?:\.[a-z0-9_]+)+)["']/g;
  while ((match = anyStringLiteralRegex.exec(source))) {
    const candidate = match[1];
    if (enKeys.has(candidate)) keys.add(candidate);
  }

  // Handle template-prefix dynamic usage like:
  // t(`messages.error.${actionData.errorKey}`)
  const templatePrefixRegex = /\bt\(\s*`([a-z0-9_]+(?:\.[a-z0-9_]+)*)\.\$\{/g;
  while ((match = templatePrefixRegex.exec(source))) {
    const prefix = `${match[1]}.`;
    for (const key of enKeys) {
      if (key.startsWith(prefix)) keys.add(key);
    }
  }

  return keys;
}

const i18nSource = fs.readFileSync(i18nFile, 'utf8');
const enBlockMatch = i18nSource.match(/const\s+en\s*:\s*Record<TranslationKey,\s*string>\s*=\s*\{([\s\S]*?)\n\};/);
if (!enBlockMatch) {
  console.error('Could not locate `en` dictionary in app/lib/i18n.ts');
  process.exit(1);
}

const enBlock = enBlockMatch[1];
const enKeys = new Set();
for (const m of enBlock.matchAll(/["'`]([^"'`]+)["'`]\s*:/g)) {
  enKeys.add(m[1]);
}

const appFiles = walk(appDir).filter((file) => !file.endsWith(path.join('lib', 'i18n.ts')));
const usedKeys = new Set();
for (const file of appFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const keys = extractTranslationKeys(source, enKeys);
  for (const key of keys) usedKeys.add(key);
}

const missingInEn = [...usedKeys].filter((key) => !enKeys.has(key)).sort();
const unusedInCode = [...enKeys].filter((key) => !usedKeys.has(key)).sort();

if (missingInEn.length > 0) {
  console.error('Missing i18n keys in EN dictionary:');
  for (const key of missingInEn) console.error(`  - ${key}`);
}

if (unusedInCode.length > 0) {
  console.warn('Unused EN i18n keys (cleanup optional):');
  for (const key of unusedInCode) console.warn(`  - ${key}`);
}

if (missingInEn.length > 0) {
  process.exit(1);
}

console.log(`i18n check passed. Used keys: ${usedKeys.size}, EN keys: ${enKeys.size}`);
