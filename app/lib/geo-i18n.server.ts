/**
 * Geo i18n helpers — auto-translate country and city names for all supported locales.
 *
 * Countries  → Node.js built-in Intl.DisplayNames (zero external calls)
 * Cities     → Google Places API (one place-details call per locale)
 */

import type { SupportedLocale } from "~/lib/locale";

const SUPPORTED_LOCALES: SupportedLocale[] = ["en", "de", "fr", "it", "es", "nl", "pt"];

// ---------------------------------------------------------------------------
// Country translations (Intl.DisplayNames – synchronous, no API needed)
// ---------------------------------------------------------------------------

/**
 * Given an ISO 3166-1 alpha-2 country code (e.g. "AT"), returns a map
 * { en: "Austria", de: "Österreich", it: "Austria", ... }
 */
export function buildCountryI18nFromCode(countryCode: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const locale of SUPPORTED_LOCALES) {
    try {
      const dn = new Intl.DisplayNames([locale], { type: "region" });
      const name = dn.of(countryCode.toUpperCase());
      if (name) result[locale] = name;
    } catch {
      // skip if Intl doesn't support the locale
    }
  }
  return result;
}

/**
 * Best-effort reverse lookup: given a country name in *any* supported language,
 * return the ISO code. Useful when the admin types "Germany" or "Germania".
 */
const ISO_COUNTRY_CODES = [
  "AD","AE","AF","AG","AI","AL","AM","AO","AR","AT","AU","AZ","BA","BB","BD","BE","BF","BG","BH","BI",
  "BJ","BN","BO","BR","BS","BT","BW","BY","BZ","CA","CD","CF","CG","CH","CI","CL","CM","CN","CO","CR",
  "CU","CV","CY","CZ","DE","DJ","DK","DM","DO","DZ","EC","EE","EG","ER","ES","ET","FI","FJ","FK","FM",
  "FO","FR","GA","GB","GD","GE","GH","GI","GL","GM","GN","GQ","GR","GT","GW","GY","HK","HN","HR","HT",
  "HU","ID","IE","IL","IN","IQ","IR","IS","IT","JM","JO","JP","KE","KG","KH","KI","KM","KN","KP","KR",
  "KW","KZ","LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY","MA","MC","MD","ME","MG","MH","MK",
  "ML","MM","MN","MO","MR","MT","MU","MV","MW","MX","MY","MZ","NA","NE","NG","NI","NL","NO","NP","NR",
  "NZ","OM","PA","PE","PG","PH","PK","PL","PM","PR","PS","PT","PW","PY","QA","RO","RS","RU","RW","SA",
  "SB","SC","SD","SE","SG","SI","SK","SL","SM","SN","SO","SR","SS","ST","SV","SY","SZ","TD","TG","TH",
  "TJ","TL","TM","TN","TO","TR","TT","TV","TW","TZ","UA","UG","US","UY","UZ","VA","VC","VE","VN","VU",
  "WS","XK","YE","ZA","ZM","ZW",
];

let _countryNameToCode: Map<string, string> | null = null;

function getCountryNameToCodeMap(): Map<string, string> {
  if (_countryNameToCode) return _countryNameToCode;
  _countryNameToCode = new Map();
  for (const code of ISO_COUNTRY_CODES) {
    for (const locale of SUPPORTED_LOCALES) {
      try {
        const dn = new Intl.DisplayNames([locale], { type: "region" });
        const name = dn.of(code);
        if (name) _countryNameToCode.set(name.toLowerCase(), code);
      } catch {
        // skip
      }
    }
  }
  return _countryNameToCode;
}

export function countryNameToCode(name: string): string | null {
  // If it's already a 2-letter code
  if (/^[A-Z]{2}$/i.test(name.trim())) return name.trim().toUpperCase();
  const map = getCountryNameToCodeMap();
  return map.get(name.trim().toLowerCase()) || null;
}

// ---------------------------------------------------------------------------
// City translations (Google Places API – async, one call per locale)
// ---------------------------------------------------------------------------

const GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1";

/**
 * Given a Google Place ID, fetch the displayName in each supported locale.
 * Returns e.g. { en: "Vienna", de: "Wien", fr: "Vienne", it: "Vienna", ... }
 */
export async function buildCityI18nFromPlaceId(
  placeId: string
): Promise<Record<string, string>> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return {};

  const results: Record<string, string> = {};

  // Fetch place details in all locales in parallel
  const fetches = SUPPORTED_LOCALES.map(async (locale) => {
    try {
      const url = `${GOOGLE_PLACES_BASE}/places/${encodeURIComponent(placeId)}?fields=displayName,addressComponents&languageCode=${locale}`;
      const response = await fetch(url, {
        headers: { "X-Goog-Api-Key": apiKey },
      });
      if (!response.ok) return;
      const place = await response.json();

      // Extract city name from addressComponents (type "locality")
      const locality = place.addressComponents?.find(
        (c: any) => c.types?.includes("locality")
      );
      if (locality?.text) {
        results[locale] = locality.text;
      }
    } catch {
      // silently skip failed locale
    }
  });

  await Promise.all(fetches);
  return results;
}

/**
 * Given a Google Place ID, fetch the country name in each supported locale.
 * Useful as a fallback when we don't have the ISO country code.
 */
export async function buildCountryI18nFromPlaceId(
  placeId: string
): Promise<{ countryCode: string | null; i18n: Record<string, string> }> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { countryCode: null, i18n: {} };

  // Single call to get the country code from addressComponents
  try {
    const url = `${GOOGLE_PLACES_BASE}/places/${encodeURIComponent(placeId)}?fields=addressComponents&languageCode=en`;
    const response = await fetch(url, {
      headers: { "X-Goog-Api-Key": apiKey },
    });
    if (!response.ok) return { countryCode: null, i18n: {} };
    const place = await response.json();

    const countryComponent = place.addressComponents?.find(
      (c: any) => c.types?.includes("country")
    );
    const code = countryComponent?.languageCode === "en"
      ? null
      : countryComponent?.text;
    // The short code is not directly in new Places API, but we can derive
    // from the component's shortText field
    const shortCode = countryComponent?.shortText || null;

    if (shortCode) {
      return {
        countryCode: shortCode,
        i18n: buildCountryI18nFromCode(shortCode),
      };
    }

    return { countryCode: null, i18n: {} };
  } catch {
    return { countryCode: null, i18n: {} };
  }
}

/**
 * All-in-one: given a city Place ID, build i18n for both city and country.
 * Returns everything needed to populate the event's i18n fields.
 */
export async function buildGeoI18nFromPlaceId(placeId: string): Promise<{
  cityI18n: Record<string, string>;
  countryI18n: Record<string, string>;
  countryCode: string | null;
  cityEn: string | null;
  countryEn: string | null;
}> {
  const [cityI18n, countryData] = await Promise.all([
    buildCityI18nFromPlaceId(placeId),
    buildCountryI18nFromPlaceId(placeId),
  ]);

  return {
    cityI18n,
    countryI18n: countryData.i18n,
    countryCode: countryData.countryCode,
    cityEn: cityI18n.en || null,
    countryEn: countryData.i18n.en || null,
  };
}
