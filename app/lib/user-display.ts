/**
 * Converts each word to Title Case: "manuel antonio marquez" → "Manuel Antonio Marquez"
 */
export function toTitleCase(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Abbreviates middle names for compact display:
 * "Manuel Antonio Marquez" → "Manuel A. Marquez"
 * "Marco Rossi" → "Marco Rossi" (no change)
 */
export function getShortDisplayName(profile: any): string {
  const full = getPublicDisplayName(profile);
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return full;
  const first = parts[0];
  const last = parts[parts.length - 1];
  const middles = parts.slice(1, -1).map((m) => m.charAt(0).toUpperCase() + ".");
  return [first, ...middles, last].join(" ");
}

export function getPublicDisplayName(profile: any): string {
  if (!profile) return "User";

  if (profile.user_type === "agency") {
    return profile.company_name || "Tour Operator";
  }

  return profile.full_name || profile.company_name || profile.email || "User";
}

export function getPublicInitial(profile: any): string {
  const name = getPublicDisplayName(profile);
  return name.charAt(0).toUpperCase() || "?";
}
