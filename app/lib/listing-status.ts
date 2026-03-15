function parseDateOnlyUtc(rawDate: string): Date | null {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate || "");
  if (dateOnlyMatch) {
    const yyyy = Number(dateOnlyMatch[1]);
    const mm = Number(dateOnlyMatch[2]) - 1;
    const dd = Number(dateOnlyMatch[3]);
    return new Date(Date.UTC(yyyy, mm, dd));
  }

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

export function isEventExpired(eventDateString: string, now = new Date()): boolean {
  const eventDateUtc = parseDateOnlyUtc(eventDateString);
  if (!eventDateUtc) return false;
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return todayUtc.getTime() >= eventDateUtc.getTime();
}
