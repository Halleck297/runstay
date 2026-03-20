/**
 * GET /api/places/geo-i18n?placeId=xxx — Fetch city + country translations
 * for a given Google Place ID. Admin-only endpoint used during marathon creation.
 */
import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import { buildGeoI18nFromPlaceId } from "~/lib/geo-i18n.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const url = new URL(request.url);
  const placeId = url.searchParams.get("placeId");

  if (!placeId) {
    return data({ error: "Missing placeId" }, { status: 400 });
  }

  const result = await buildGeoI18nFromPlaceId(placeId);
  return data(result);
}
