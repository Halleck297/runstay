import type { SupportedLocale } from "~/lib/locale";
import { DEFAULT_LOCALE, getSupportedLocales } from "~/lib/locale";

const SUPPORTED_COUNTRY_CODES = [
  // Continental Europe + nearby
  "AL", "AT", "BE", "BA", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IS", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "MC", "ME", "NL",
  "NO", "PL", "PT", "RO", "RS", "RU", "SK", "SI", "ES", "SE", "CH", "UA", "GB",
  // Americas (selected)
  "US", "CA", "MX", "AR", "BR", "CL", "CO", "CR", "DO", "EC", "PA", "PE", "PY", "UY",
  // APAC selected
  "AU", "JP",
] as const;

export type SupportedCountryCode = (typeof SUPPORTED_COUNTRY_CODES)[number];

export type SupportedCountry = {
  code: SupportedCountryCode;
  name: string;
  nameEn: string;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getDisplayName(code: string, locale: string): string | null {
  try {
    const regionNames = new Intl.DisplayNames([locale], { type: "region" });
    const name = regionNames.of(code);
    if (!name || name.toLowerCase() === code.toLowerCase()) return null;
    return name;
  } catch {
    return null;
  }
}

function getEnglishName(code: SupportedCountryCode): string {
  return getDisplayName(code, "en") || code;
}

function getLocalizedName(code: SupportedCountryCode, locale: SupportedLocale): string {
  return getDisplayName(code, locale) || getEnglishName(code);
}

export function getSupportedCountries(locale: SupportedLocale): SupportedCountry[] {
  return [...SUPPORTED_COUNTRY_CODES]
    .map((code) => ({
      code,
      name: getLocalizedName(code, locale),
      nameEn: getEnglishName(code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getCountryDisplayName(rawInput: string | null | undefined, locale: SupportedLocale): string {
  const raw = (rawInput || "").trim();
  if (!raw) return "";

  const resolved = resolveSupportedCountry(raw, locale);
  if (!resolved) return raw;

  return getLocalizedName(resolved.code, locale);
}

export function resolveSupportedCountry(
  rawInput: string,
  locale: SupportedLocale = DEFAULT_LOCALE
): { code: SupportedCountryCode; nameEn: string } | null {
  const input = normalizeText(rawInput);
  if (!input) return null;

  for (const code of SUPPORTED_COUNTRY_CODES) {
    const nameEn = getEnglishName(code);
    if (input === normalizeText(code) || input === normalizeText(nameEn)) {
      return { code, nameEn };
    }

    const localizedName = getLocalizedName(code, locale);
    if (input === normalizeText(localizedName)) {
      return { code, nameEn };
    }
  }

  // Secondary fallback: also accept names typed in any app-supported locale.
  for (const localeCode of getSupportedLocales()) {
    for (const code of SUPPORTED_COUNTRY_CODES) {
      const localizedName = getLocalizedName(code, localeCode);
      if (input === normalizeText(localizedName)) {
        return { code, nameEn: getEnglishName(code) };
      }
    }
  }

  return null;
}
