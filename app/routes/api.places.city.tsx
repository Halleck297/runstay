/**
 * POST /api/places/city — City autocomplete for marathon location selection.
 * Wraps Google Places Autocomplete API, filtered to cities only.
 */
import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { requireAdmin } from "~/lib/session.server";

const GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1";

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return data({ error: "Places API not configured" }, { status: 503 });
  }

  const body = await request.json();
  const { input, sessionToken } = body;

  if (!input || typeof input !== "string" || input.trim().length < 2) {
    return data({ suggestions: [] });
  }

  const requestBody: Record<string, any> = {
    input: input.trim(),
    includedPrimaryTypes: ["(cities)"],
  };
  if (sessionToken) requestBody.sessionToken = sessionToken;

  const response = await fetch(`${GOOGLE_PLACES_BASE}/places:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    return data({ error: "Failed to fetch city suggestions" }, { status: response.status });
  }

  const result = await response.json();
  return data(result);
}
