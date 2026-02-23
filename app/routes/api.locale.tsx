import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { getUserId } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import {
  buildLocaleCookie,
  getSupportedLocales,
  isSupportedLocale,
  stripLocaleFromPathname,
} from "~/lib/locale";
import type { SupportedLocale } from "~/lib/locale";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const localeValue = formData.get("locale");
  const redirectToValue = formData.get("redirectTo");
  const persistValue = formData.get("persist");

  if (typeof localeValue !== "string" || !isSupportedLocale(localeValue.toLowerCase())) {
    return data(
      { error: "Invalid locale", supported: getSupportedLocales() },
      { status: 400 }
    );
  }

  const locale = localeValue.toLowerCase() as SupportedLocale;
  const redirectTo =
    typeof redirectToValue === "string" && redirectToValue.startsWith("/")
      ? `${stripLocaleFromPathname(redirectToValue)}`
      : null;
  const persist = persistValue === "1" || persistValue === "true";

  const userId = await getUserId(request);
  if (userId && persist) {
    await (supabaseAdmin.from("profiles") as any)
      .update({ preferred_language: locale })
      .eq("id", userId);
  }

  return data(
    {
      success: true,
      locale,
      persist,
      redirectTo,
    },
    {
      headers: {
        "Set-Cookie": buildLocaleCookie(locale, { persistent: persist }),
      },
    }
  );
}
