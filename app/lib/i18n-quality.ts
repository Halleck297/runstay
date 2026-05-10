type ListingLike = {
  listing_type?: string | null;
  description_i18n?: unknown;
  cost_notes_note_i18n?: unknown;
  title_i18n?: unknown;
};

export type TranslationQualitySeverity = "warning" | "blocking";

export type TranslationQualityIssue = {
  severity: TranslationQualitySeverity;
  locale: string;
  field: "title_i18n" | "description_i18n" | "cost_notes_note_i18n";
  term: string;
  message: string;
};

const BIB_LISTING_TYPES = new Set(["bib", "room_and_bib"]);

const TERM_FIXES: Record<string, Array<{ pattern: RegExp; replacement: string }>> = {
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

const BLOCKED_TERMS: Record<string, Array<{ pattern: RegExp; label: string; expected: string }>> = {
  es: [{ pattern: /\bbaberos?\b/i, label: "babero", expected: "dorsal" }],
  fr: [{ pattern: /\bbiberons?\b/i, label: "biberon", expected: "dossard" }],
};

const WARNING_TERMS: Record<string, Array<{ pattern: RegExp; label: string; expected: string }>> = {
  es: [{ pattern: /\brace bibs?\b|\bbibs?\b/i, label: "bib", expected: "dorsal" }],
  fr: [{ pattern: /\brace bibs?\b|\bbibs?\b/i, label: "bib", expected: "dossard" }],
};

export function isBibListingType(listingType: string | null | undefined): boolean {
  return BIB_LISTING_TYPES.has(String(listingType || ""));
}

export function normalizeDynamicListingTranslation(args: {
  text: string;
  locale: string;
  listingType?: string | null;
}): string {
  if (!isBibListingType(args.listingType)) return args.text;

  const fixes = TERM_FIXES[args.locale] || [];
  return fixes.reduce((value, fix) => value.replace(fix.pattern, fix.replacement), args.text);
}

function readI18nObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function validateListingTranslationQuality(listing: ListingLike): TranslationQualityIssue[] {
  if (!isBibListingType(listing.listing_type)) return [];

  const issues: TranslationQualityIssue[] = [];
  const fields: TranslationQualityIssue["field"][] = ["title_i18n", "description_i18n", "cost_notes_note_i18n"];

  for (const field of fields) {
    const values = readI18nObject(listing[field]);
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
          message: `${field}.${locale} contiene "${rule.label}". Nel contesto running usare "${rule.expected}".`,
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
          message: `${field}.${locale} contiene ancora "${rule.label}". Nel contesto running verificare "${rule.expected}".`,
        });
      }
    }
  }

  return issues;
}

export function hasBlockingTranslationIssues(issues: TranslationQualityIssue[]): boolean {
  return issues.some((issue) => issue.severity === "blocking");
}
