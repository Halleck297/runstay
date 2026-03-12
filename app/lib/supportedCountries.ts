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

const COUNTRY_DIALING_PREFIX: Record<SupportedCountryCode, string> = {
  AL: "+355",
  AT: "+43",
  BE: "+32",
  BA: "+387",
  BG: "+359",
  HR: "+385",
  CY: "+357",
  CZ: "+420",
  DK: "+45",
  EE: "+372",
  FI: "+358",
  FR: "+33",
  DE: "+49",
  GR: "+30",
  HU: "+36",
  IS: "+354",
  IE: "+353",
  IT: "+39",
  LV: "+371",
  LI: "+423",
  LT: "+370",
  LU: "+352",
  MT: "+356",
  MC: "+377",
  ME: "+382",
  NL: "+31",
  NO: "+47",
  PL: "+48",
  PT: "+351",
  RO: "+40",
  RS: "+381",
  RU: "+7",
  SK: "+421",
  SI: "+386",
  ES: "+34",
  SE: "+46",
  CH: "+41",
  UA: "+380",
  GB: "+44",
  US: "+1",
  CA: "+1",
  MX: "+52",
  AR: "+54",
  BR: "+55",
  CL: "+56",
  CO: "+57",
  CR: "+506",
  DO: "+1",
  EC: "+593",
  PA: "+507",
  PE: "+51",
  PY: "+595",
  UY: "+598",
  AU: "+61",
  JP: "+81",
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

export function getDialingPrefix(code: SupportedCountryCode): string {
  return COUNTRY_DIALING_PREFIX[code];
}

const COUNTRY_TO_LOCALE: Partial<Record<SupportedCountryCode, SupportedLocale>> = {
  IT: "it",
  ES: "es",
  MX: "es",
  AR: "es",
  CL: "es",
  CO: "es",
  CR: "es",
  DO: "es",
  EC: "es",
  PA: "es",
  PE: "es",
  PY: "es",
  UY: "es",
  PT: "pt",
  BR: "pt",
  FR: "fr",
  MC: "fr",
  LU: "fr",
  DE: "de",
  AT: "de",
  CH: "de",
  NL: "nl",
  BE: "nl",
};

export function getSuggestedLocaleForCountry(
  code: SupportedCountryCode,
  fallback: SupportedLocale = DEFAULT_LOCALE
): SupportedLocale {
  return COUNTRY_TO_LOCALE[code] ?? fallback;
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
