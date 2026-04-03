/**
 * Stable date formatting utilities.
 *
 * Node.js and browsers can disagree on short month names produced by
 * `Intl.DateTimeFormat` (e.g. "Sept" in Node vs "Sep" in Chrome).
 * These helpers normalise the output so server-rendered HTML always
 * matches the client, preventing React hydration mismatches.
 */

/**
 * Parse a date-only string (YYYY-MM-DD) into a UTC Date without
 * timezone drift. Falls back to `new Date(raw)` for other formats.
 */
export function parseDateStable(raw: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Date(raw);
}

/** Normalise known Node-vs-browser month abbreviation differences. */
function normaliseMonth(s: string): string {
  return s.replace(/\bSept\b/g, "Sep");
}

/**
 * Format a raw date string (typically from the DB) using Intl, with
 * consistent output across Node and browsers.
 */
export function formatDateStable(
  rawDate: string,
  locale: string | string[],
  options: Intl.DateTimeFormatOptions,
): string {
  const parsed = parseDateStable(rawDate);
  if (Number.isNaN(parsed.getTime())) return rawDate;
  const formatted = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(parsed);
  return normaliseMonth(formatted);
}

/**
 * Wrapper around `Date.toLocaleDateString` that normalises short
 * month names (use in place of `date.toLocaleDateString(…)`).
 */
export function toLocaleDateStable(
  date: Date,
  locale: string | string[],
  options: Intl.DateTimeFormatOptions,
): string {
  return normaliseMonth(date.toLocaleDateString(locale, options));
}
