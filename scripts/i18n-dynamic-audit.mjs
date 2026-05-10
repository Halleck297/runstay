import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SHOULD_FIX = process.argv.includes("--fix");
const REPORT_DIR = path.join(process.cwd(), "reports");

const FIELDS = ["title_i18n", "description_i18n", "cost_notes_note_i18n"];
const BLOCKED_TERMS = {
  es: [{ pattern: /\bbaberos?\b/i, label: "babero", expected: "dorsal" }],
  fr: [{ pattern: /\bbiberons?\b/i, label: "biberon", expected: "dossard" }],
};
const TERM_FIXES = {
  es: [
    { pattern: /\brace bibs\b/gi, replacement: "dorsales" },
    { pattern: /\brace bib\b/gi, replacement: "dorsal" },
    { pattern: /\bbibs\b/gi, replacement: "dorsales" },
    { pattern: /\bbib\b/gi, replacement: "dorsal" },
    { pattern: /\bbaberos\b/gi, replacement: "dorsales" },
    { pattern: /\bbabero\b/gi, replacement: "dorsal" },
  ],
  fr: [
    { pattern: /\brace bibs\b/gi, replacement: "dossards" },
    { pattern: /\brace bib\b/gi, replacement: "dossard" },
    { pattern: /\bbibs\b/gi, replacement: "dossards" },
    { pattern: /\bbib\b/gi, replacement: "dossard" },
    { pattern: /\bbiberons\b/gi, replacement: "dossards" },
    { pattern: /\bbiberon\b/gi, replacement: "dossard" },
  ],
};
const WARNING_TERMS = {
  es: [{ pattern: /\brace bibs?\b|\bbibs?\b/i, label: "bib", expected: "dorsal" }],
  fr: [{ pattern: /\brace bibs?\b|\bbibs?\b/i, label: "bib", expected: "dossard" }],
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function validateListing(listing) {
  const issues = [];
  for (const field of FIELDS) {
    const values = asObject(listing[field]);
    for (const [locale, rules] of Object.entries(BLOCKED_TERMS)) {
      const text = values[locale];
      if (typeof text !== "string" || !text.trim()) continue;
      for (const rule of rules) {
        if (!rule.pattern.test(text)) continue;
        issues.push({
          severity: "blocking",
          locale,
          field,
          term: rule.label,
          expected: rule.expected,
          text,
        });
      }
    }

    for (const [locale, rules] of Object.entries(WARNING_TERMS)) {
      const text = values[locale];
      if (typeof text !== "string" || !text.trim()) continue;
      for (const rule of rules) {
        if (!rule.pattern.test(text)) continue;
        issues.push({
          severity: "warning",
          locale,
          field,
          term: rule.label,
          expected: rule.expected,
          text,
        });
      }
    }
  }
  return issues;
}

function normalizeI18nMap(value) {
  const source = asObject(value);
  const next = { ...source };
  let changed = false;

  for (const [locale, fixes] of Object.entries(TERM_FIXES)) {
    const text = next[locale];
    if (typeof text !== "string") continue;
    const normalized = fixes.reduce((acc, fix) => acc.replace(fix.pattern, fix.replacement), text);
    if (normalized !== text) {
      next[locale] = normalized;
      changed = true;
    }
  }

  return { changed, value: next };
}

async function fetchListings() {
  const listings = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("listings")
      .select("id, short_id, status, listing_type, title, title_i18n, description_i18n, cost_notes_note_i18n")
      .in("listing_type", ["bib", "room_and_bib"])
      .range(from, to);

    if (error) throw error;
    listings.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return listings;
}

async function main() {
  const listings = await fetchListings();
  const report = [];
  let fixedCount = 0;

  for (const listing of listings) {
    const issues = validateListing(listing);
    if (issues.length === 0) continue;

    report.push({
      id: listing.id,
      short_id: listing.short_id,
      status: listing.status,
      listing_type: listing.listing_type,
      title: listing.title,
      issues,
    });

    if (SHOULD_FIX) {
      const patch = {};
      for (const field of FIELDS) {
        const normalized = normalizeI18nMap(listing[field]);
        if (normalized.changed) patch[field] = normalized.value;
      }

      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from("listings").update(patch).eq("id", listing.id);
        if (error) throw error;
        fixedCount += 1;
      }
    }
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const jsonPath = path.join(REPORT_DIR, "i18n-dynamic-audit.json");
  const txtPath = path.join(REPORT_DIR, "i18n-dynamic-audit.txt");
  fs.writeFileSync(jsonPath, JSON.stringify({ fix: SHOULD_FIX, scanned: listings.length, fixedCount, report }, null, 2));
  fs.writeFileSync(
    txtPath,
    [
      `Mode: ${SHOULD_FIX ? "fix" : "audit"}`,
      `Scanned bib/package listings: ${listings.length}`,
      `Listings with translation issues: ${report.length}`,
      `Fixed listings: ${fixedCount}`,
      "",
      ...report.map((item) => {
        const publicId = item.short_id || item.id;
        const issueLines = item.issues.map((issue) => `  - ${issue.field}.${issue.locale}: ${issue.term} -> ${issue.expected}`);
        return [`${publicId} [${item.status}] ${item.title}`, ...issueLines].join("\n");
      }),
    ].join("\n")
  );

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${txtPath}`);
  if (SHOULD_FIX) console.log(`Fixed listings: ${fixedCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
