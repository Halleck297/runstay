import type { UserType } from "~/lib/database.types";

export type TransferMethod = "official_process" | "package" | "contact";

export const LISTING_RULES = {
  private: {
    maxRooms: 1,
    maxBibs: 1,
    allowedTransferMethods: ["official_process"] as TransferMethod[],
    description: "Exchange platform for individual runners"
  },
  tour_operator: {
    maxRooms: null, // unlimited
    maxBibs: null,  // unlimited
    allowedTransferMethods: ["official_process", "package"] as TransferMethod[],
    description: "Business platform for tour operators"
  }
} as const;

type ListingRulesUserType = keyof typeof LISTING_RULES;

function resolveListingRulesUserType(userType: UserType): ListingRulesUserType {
  return userType === "tour_operator" ? "tour_operator" : "private";
}

/**
 * Verifica se un utente può usare un determinato transfer method
 */
export function canUseTransferMethod(
  userType: UserType,
  method: TransferMethod
): boolean {
  const rulesUserType = resolveListingRulesUserType(userType);
  return LISTING_RULES[rulesUserType].allowedTransferMethods.includes(method);
}

/**
 * Ottiene il limite massimo per un tipo di risorsa
 */
export function getMaxLimit(
  userType: UserType,
  resourceType: "rooms" | "bibs"
): number | null {
  const rulesUserType = resolveListingRulesUserType(userType);
  return resourceType === "rooms"
    ? LISTING_RULES[rulesUserType].maxRooms
    : LISTING_RULES[rulesUserType].maxBibs;
}

/**
 * Ottiene le opzioni disponibili per il transfer method dropdown
 */
export function getTransferMethodOptions(userType: UserType) {
  const rulesUserType = resolveListingRulesUserType(userType);
  const methods = LISTING_RULES[rulesUserType].allowedTransferMethods;

  const labels: Record<TransferMethod, string> = {
    official_process: "Official name change",
    package: "Included in travel package",
    contact: "Contact for details"
  };

  return methods.map((method: TransferMethod) => ({
    value: method,
    label: labels[method]
  }));
}

/**
 * Determina quali campi mostrare basandosi su user type e transfer method
 */
export function getVisibleFieldsForTransferMethod(
  userType: UserType,
  transferMethod: TransferMethod | null,
  listingType: "bib" | "room_and_bib"
): {
  showAssociatedCosts: boolean;
  showCostNotes: boolean;
  showPackageInfo: boolean;
} {
  // Nessun campo visibile se non è selezionato un transfer method
  if (!transferMethod) {
    return {
      showAssociatedCosts: false,
      showCostNotes: false,
      showPackageInfo: false
    };
  }

  // Per "official_process" mostra associated costs SOLO per privati
  if (transferMethod === "official_process") {
    // Solo per listing di tipo "bib" E solo per utenti privati
    const shouldShow = listingType === "bib" && userType === "private";
    return {
      showAssociatedCosts: shouldShow,
      showCostNotes: false, // Rimosso per privati
      showPackageInfo: false
    };
  }

  // Per "package" (solo TO) mostra info che i costi sono nel prezzo
  if (transferMethod === "package") {
    return {
      showAssociatedCosts: false,
      showCostNotes: false,
      showPackageInfo: true
    };
  }

  // Default: nessun campo
  return {
    showAssociatedCosts: false,
    showCostNotes: false,
    showPackageInfo: false
  };
}

/**
 * Validazione server-side dei limiti
 */
export function validateListingLimits(
  userType: UserType,
  roomCount: number | null,
  bibCount: number | null,
  transferMethod: string | null
): { valid: boolean; error?: string } {
  const rules = LISTING_RULES[resolveListingRulesUserType(userType)];

  // Valida room count
  if (roomCount && rules.maxRooms !== null && roomCount > rules.maxRooms) {
    return {
      valid: false,
      error: `${userType === "private" ? "Private users" : "Your account type"} can list maximum ${rules.maxRooms} room${rules.maxRooms > 1 ? "s" : ""}`
    };
  }

  // Valida bib count
  if (bibCount && rules.maxBibs !== null && bibCount > rules.maxBibs) {
    return {
      valid: false,
      error: `${userType === "private" ? "Private users" : "Your account type"} can exchange maximum ${rules.maxBibs} ${rules.maxBibs > 1 ? "entries" : "entry"}`
    };
  }

  // Valida transfer method
  if (transferMethod && !canUseTransferMethod(userType, transferMethod as TransferMethod)) {
    return {
      valid: false,
      error: `Transfer method "${transferMethod}" is not available for your account type`
    };
  }

  return { valid: true };
}
