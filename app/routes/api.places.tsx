import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { requireUser } from "~/lib/session.server";

const GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1";

// GET /api/places?placeId=xxx&sessionToken=xxx → place details
export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return data({ error: "Places API not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const placeId = url.searchParams.get("placeId");
  const sessionToken = url.searchParams.get("sessionToken");

  if (!placeId) {
    return data({ error: "Missing placeId" }, { status: 400 });
  }

  const fields = "id,displayName,formattedAddress,addressComponents,location,rating,websiteUri";
  const placeUrl = `${GOOGLE_PLACES_BASE}/places/${encodeURIComponent(placeId)}?fields=${fields}${sessionToken ? `&sessionToken=${sessionToken}` : ""}`;

  const response = await fetch(placeUrl, {
    headers: { "X-Goog-Api-Key": apiKey },
  });

  if (!response.ok) {
    return data({ error: "Failed to fetch place details" }, { status: response.status });
  }

  const place = await response.json();
  return data(place);
}

// POST /api/places → autocomplete suggestions
export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return data({ error: "Places API not configured" }, { status: 503 });
  }

  const body = await request.json();

  const response = await fetch(`${GOOGLE_PLACES_BASE}/places:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return data({ error: "Failed to fetch suggestions" }, { status: response.status });
  }

  const result = await response.json();
  return data(result);
}
