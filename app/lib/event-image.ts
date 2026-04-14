/**
 * Returns the slug used for event image lookup (year-agnostic).
 * e.g. "tokyo-marathon-2027" → "tokyo-marathon" → /events/tokyo-marathon.jpg
 */
export function getEventImageSlug(event: { name: string; slug?: string | null }): string {
  const base = event.slug || event.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base.replace(/-\d{4}$/, '');
}
