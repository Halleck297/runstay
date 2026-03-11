import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { resolveLocaleForRequest, localizeEvent } from "~/lib/locale";
import { supabaseAdmin } from "~/lib/supabase.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  const locale = resolveLocaleForRequest(request, null);

  if (query.length < 2) {
    return data({ events: [] });
  }

  const { data: events } = await supabaseAdmin
    .from("events")
    .select("id, name, name_i18n, country, country_i18n, event_date")
    .or(`name.ilike.%${query}%,country.ilike.%${query}%`)
    .order("event_date", { ascending: true })
    .limit(5);

  const localized = (events || []).map((event: any) => {
    const e = localizeEvent(event, locale);
    return {
      id: e.id,
      name: e.name,
      country: e.country,
      event_date: e.event_date,
    };
  });

  return data({ events: localized });
}

