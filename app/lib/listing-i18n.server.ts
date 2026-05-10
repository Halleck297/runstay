import { DEFAULT_LOCALE, getSupportedLocales, getLocaleFromPreferredLanguage } from "~/lib/locale";
import { detectLanguage, normalizeLanguageCode, translateText } from "~/lib/translate.server";
import { normalizeDynamicListingTranslation } from "~/lib/i18n-quality";

type I18nMap = Record<string, string>;

function normalizeSourceLanguage(sourceLanguage: string | null | undefined): string | null {
  if (!sourceLanguage) return null;
  const normalized = normalizeLanguageCode(sourceLanguage);
  const supported = new Set(getSupportedLocales());
  return supported.has(normalized as any) ? normalized : null;
}

async function resolveSourceLanguage(text: string, sourceLanguageHint?: string | null): Promise<string> {
  const hinted = normalizeSourceLanguage(sourceLanguageHint || null);
  if (hinted) return hinted;

  const detected = await detectLanguage(text);
  const normalizedDetected = normalizeSourceLanguage(detected?.language || null);
  if (normalizedDetected) return normalizedDetected;

  return DEFAULT_LOCALE;
}

export async function buildI18nMap(
  rawText: string | null | undefined,
  sourceLanguageHint?: string | null,
  options?: { listingType?: string | null }
): Promise<I18nMap | null> {
  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (!text) return null;

  const sourceLanguage = await resolveSourceLanguage(text, sourceLanguageHint);
  const locales = getSupportedLocales();
  const map: I18nMap = {
    [sourceLanguage]: text,
  };

  await Promise.all(
    locales.map(async (locale) => {
      if (locale === sourceLanguage) return;
      const translated = await translateText(text, locale, sourceLanguage);
      const translatedText = translated?.translatedText?.trim() || text;
      map[locale] = normalizeDynamicListingTranslation({
        text: translatedText,
        locale,
        listingType: options?.listingType,
      });
    })
  );

  if (!map[DEFAULT_LOCALE]) {
    map[DEFAULT_LOCALE] = text;
  }

  return map;
}

export async function buildListingI18nFields(args: {
  title?: string | null;
  description?: string | null;
  hotelName?: string | null;
  hotelCity?: string | null;
  hotelCountry?: string | null;
  sourceLanguageHint?: string | null;
  listingType?: string | null;
}): Promise<{
  title_i18n: I18nMap | null;
  description_i18n: I18nMap | null;
  hotel_name_i18n: I18nMap | null;
  hotel_city_i18n: I18nMap | null;
  hotel_country_i18n: I18nMap | null;
}> {
  const sourceHint = normalizeSourceLanguage(args.sourceLanguageHint || null);
  return {
    title_i18n: await buildI18nMap(args.title, sourceHint, { listingType: args.listingType }),
    description_i18n: await buildI18nMap(args.description, sourceHint, { listingType: args.listingType }),
    hotel_name_i18n: await buildI18nMap(args.hotelName, sourceHint),
    hotel_city_i18n: await buildI18nMap(args.hotelCity, sourceHint),
    hotel_country_i18n: await buildI18nMap(args.hotelCountry, sourceHint),
  };
}

export function getSourceLanguageFromProfile(preferredLanguage: string | null | undefined): string | null {
  return getLocaleFromPreferredLanguage(preferredLanguage) || null;
}
