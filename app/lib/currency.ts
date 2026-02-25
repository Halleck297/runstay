import { resolveSupportedCountry } from "~/lib/supportedCountries";

export const SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP", "JPY", "CAD", "CHF", "AUD"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const USD_COUNTRIES = new Set([
  // Americas (except Canada)
  "US", "MX", "AR", "BR", "CL", "CO", "CR", "DO", "EC", "PA", "PE", "PY", "UY",
  // Explicit policy
  "RU",
]);

export function isSupportedCurrency(value: string | null | undefined): value is SupportedCurrency {
  if (!value) return false;
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value.toUpperCase());
}

export function getCurrencyForCountry(country: string | null | undefined): SupportedCurrency {
  const normalizedCountry = (country || "").trim();
  if (!normalizedCountry) return "EUR";

  const resolved = resolveSupportedCountry(normalizedCountry);
  const code = resolved?.code;
  if (!code) return "EUR";

  if (code === "CA") return "CAD";
  if (code === "CH") return "CHF";
  if (code === "AU") return "AUD";
  if (code === "GB") return "GBP";
  if (code === "JP") return "JPY";
  if (USD_COUNTRIES.has(code)) return "USD";

  return "EUR";
}

export function normalizeCurrencyOrDefault(
  value: string | null | undefined,
  country: string | null | undefined
): SupportedCurrency {
  const normalized = (value || "").trim().toUpperCase();
  if (isSupportedCurrency(normalized)) return normalized;
  return getCurrencyForCountry(country);
}

export function resolveDisplayPriceFromMap(
  priceConverted: unknown,
  preferredCurrency: SupportedCurrency
): number | null {
  if (!priceConverted || typeof priceConverted !== "object") return null;
  const raw = (priceConverted as Record<string, unknown>)[preferredCurrency];
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

export function applyListingDisplayCurrency<T extends Record<string, any>>(
  listing: T,
  preferredCurrency: SupportedCurrency
): T {
  if (!listing) return listing;
  const displayPrice = resolveDisplayPriceFromMap(listing.price_converted, preferredCurrency);
  const displayAssociatedCosts = resolveDisplayPriceFromMap(listing.associated_costs_converted, preferredCurrency);
  if (displayPrice === null && displayAssociatedCosts === null) return listing;

  return {
    ...listing,
    price: displayPrice ?? listing.price,
    associated_costs: displayAssociatedCosts ?? listing.associated_costs,
    currency: preferredCurrency,
  };
}
