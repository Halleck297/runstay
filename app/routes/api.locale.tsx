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

  const userId = await getUserId(request);
  if (userId) {
    await (supabaseAdmin.from("profiles") as any)
      .update({ languages: locale })
      .eq("id", userId);
  }

  return data(
    {
      success: true,
      locale,
      redirectTo,
    },
    {
      headers: {
        "Set-Cookie": buildLocaleCookie(locale),
      },
    }
  );
}
