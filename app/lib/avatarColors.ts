// Palette di colori per gli avatar (per utenti privati)
// Colori scelti per essere distinguibili e piacevoli
const AVATAR_COLORS = [
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-teal-100", text: "text-teal-700" },
  { bg: "bg-cyan-100", text: "text-cyan-700" },
  { bg: "bg-blue-100", text: "text-blue-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700" },
];

// Colore fisso per Tour Operator (arancione accent pieno)
const TOUR_OPERATOR_COLOR = { bg: "bg-accent-500", text: "text-white" };

/**
 * Genera un hash numerico da una stringa
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Restituisce le classi CSS per l'avatar basate sull'ID utente e tipo
 * Tour operator = sempre arancione accent
 * Private = colore basato su hash dell'ID
 */
export function getAvatarColor(userId: string, userType?: string): { bg: string; text: string } {
  // Tour operator sempre arancione
  if (userType === "tour_operator") {
    return TOUR_OPERATOR_COLOR;
  }
  // Utenti privati: colore basato su hash
  const index = hashString(userId) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

/**
 * Restituisce le classi CSS combinate per l'avatar
 */
export function getAvatarClasses(userId: string, userType?: string): string {
  const colors = getAvatarColor(userId, userType);
  return `${colors.bg} ${colors.text}`;
}
