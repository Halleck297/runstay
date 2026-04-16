/**
 * POST /api/places/city — City autocomplete for registration & profile forms.
 * Wraps Google Places Autocomplete API, filtered to cities only.
 * Open to all visitors (registration needs it); protected by rate limiting.
 */
import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit.server";

const GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1";

// 60 requests per minute per IP
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function action({ request }: ActionFunctionArgs) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return data({ error: "Places API not configured" }, { status: 503 });
  }

  // Rate limit by IP
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`places-city:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!rateCheck.allowed) {
    return data({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json();
  const { input, language, sessionToken } = body;

  if (!input || typeof input !== "string" || input.trim().length < 2) {
    return data({ suggestions: [] });
  }

  const requestBody: Record<string, any> = {
    input: input.trim(),
    includedPrimaryTypes: ["(cities)"],
  };
  if (sessionToken) requestBody.sessionToken = sessionToken;
  if (language && typeof language === "string") requestBody.languageCode = language;

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

  // Normalize the response to a simpler format for the client
  const suggestions = (result.suggestions || [])
    .filter((s: any) => s.placePrediction)
    .map((s: any) => ({
      placeId: s.placePrediction.placeId,
      description: s.placePrediction.text?.text || s.placePrediction.structuredFormat?.mainText?.text || "",
      mainText: s.placePrediction.structuredFormat?.mainText?.text || "",
      secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text || "",
    }));

  return data({ suggestions });
}
