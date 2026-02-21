import { useRouteLoaderData } from "react-router";
import { DEFAULT_LOCALE, isSupportedLocale } from "~/lib/locale";
import type { SupportedLocale } from "~/lib/locale";
import { translate } from "~/lib/i18n";
import type { TranslationKey } from "~/lib/i18n";

type RootLoaderData = {
  locale?: string;
};

export function useI18n() {
  const rootData = useRouteLoaderData("root") as RootLoaderData | undefined;
  const rawLocale = rootData?.locale?.toLowerCase();
  const locale: SupportedLocale = isSupportedLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  return {
    locale,
    t: (key: TranslationKey) => translate(locale, key),
  };
}
