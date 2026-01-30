/**
 * Distance calculation utilities
 * Uses Haversine formula for straight-line distance
 * Uses OpenRouteService API for walking/transit duration
 */

// Haversine formula to calculate straight-line distance between two points
export function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c); // Distance in meters
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Google APIs
const GOOGLE_DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json";
const GOOGLE_DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json";

interface DurationResult {
  duration: number; // minutes
  distance: number; // meters (actual route distance)
}

// Response format for Google Distance Matrix API
interface GoogleDistanceMatrixResponse {
  status: string;
  rows: Array<{
    elements: Array<{
      status: string;
      distance?: {
        value: number; // meters
        text: string;
      };
      duration?: {
        value: number; // seconds
        text: string;
      };
    }>;
  }>;
}

// Response format for Google Directions API
interface GoogleDirectionsResponse {
  status: string;
  routes: Array<{
    legs: Array<{
      distance: {
        value: number; // meters
        text: string;
      };
      duration: {
        value: number; // seconds
        text: string;
      };
    }>;
  }>;
}

/**
 * Get walking duration between two points using Google Distance Matrix API
 */
export async function getWalkingDuration(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<DurationResult | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    console.warn("GOOGLE_PLACES_API_KEY not set, skipping walking duration calculation");
    return null;
  }

  console.log("Calling Google Distance Matrix API (walking)...");

  try {
    const url = `${GOOGLE_DISTANCE_MATRIX_URL}?origins=${fromLat},${fromLng}&destinations=${toLat},${toLng}&mode=walking&key=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Distance Matrix API error:", response.status, errorText);
      return null;
    }

    const data: GoogleDistanceMatrixResponse = await response.json();
    console.log("Google Distance Matrix walking response:", JSON.stringify(data));

    if (data.status === "OK" && data.rows?.[0]?.elements?.[0]?.status === "OK") {
      const element = data.rows[0].elements[0];
      return {
        duration: Math.round((element.duration?.value || 0) / 60), // Convert seconds to minutes
        distance: element.distance?.value || 0,
      };
    }

    console.error("Google Distance Matrix API returned non-OK status:", data.status);
    return null;
  } catch (error) {
    console.error("Google Distance Matrix API error:", error);
    return null;
  }
}

/**
 * Get public transit duration between two points using Google Directions API
 * The Directions API handles mixed routes (transit + walking) better than Distance Matrix
 */
export async function getTransitDuration(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<DurationResult | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    console.warn("GOOGLE_PLACES_API_KEY not set, skipping transit duration calculation");
    return null;
  }

  console.log("Calling Google Directions API (transit)...");

  try {
    // Use next Sunday at 9:00 UTC as departure time
    // 9:00 UTC = 10:00 CET (Europe), 18:00 JST (Japan), 04:00 EST (US East)
    // This ensures transit is available in most major marathon cities
    const now = new Date();
    const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7; // Next Sunday (not today if Sunday)
    const nextSunday = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysUntilSunday,
      9, 0, 0 // 9:00 UTC
    ));
    const departureTime = Math.floor(nextSunday.getTime() / 1000); // Unix timestamp in seconds

    console.log(`Using departure time: ${nextSunday.toISOString()} (timestamp: ${departureTime})`);

    // Directions API handles walking segments to/from transit stops automatically
    const url = `${GOOGLE_DIRECTIONS_URL}?origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&mode=transit&departure_time=${departureTime}&key=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Directions API error:", response.status, errorText);
      return null;
    }

    const data: GoogleDirectionsResponse = await response.json();
    console.log("Google Directions transit response:", JSON.stringify(data));

    if (data.status === "OK" && data.routes?.[0]?.legs?.[0]) {
      const leg = data.routes[0].legs[0];
      return {
        duration: Math.round((leg.duration?.value || 0) / 60), // Convert seconds to minutes
        distance: leg.distance?.value || 0,
      };
    }

    // Transit might not be available in some areas, return null gracefully
    console.warn("Google Directions transit not available or returned non-OK status:", data.status);
    return null;
  } catch (error) {
    console.error("Google Directions API error:", error);
    return null;
  }
}

/**
 * Calculate all distance/duration data for a listing
 * Returns null values if coordinates are missing or API fails
 * @param eventDate - Event date for transit departure time calculation
 */
export async function calculateDistanceData(
  hotelLat: number | null,
  hotelLng: number | null,
  finishLat: number | null,
  finishLng: number | null,
  eventDate?: string // Format: "YYYY-MM-DD"
): Promise<{
  distance_to_finish: number | null;
  walking_duration: number | null;
  transit_duration: number | null;
}> {
  // Check if we have all required coordinates
  if (!hotelLat || !hotelLng || !finishLat || !finishLng) {
    return {
      distance_to_finish: null,
      walking_duration: null,
      transit_duration: null,
    };
  }

  // Calculate straight-line distance (always, no API needed)
  const distance = calculateHaversineDistance(hotelLat, hotelLng, finishLat, finishLng);

  // Get walking duration (always)
  const walkingResult = await getWalkingDuration(hotelLat, hotelLng, finishLat, finishLng);

  // Get transit duration only if distance > 1km
  let transitDuration: number | null = null;
  if (distance > 1000) {
    const transitResult = await getTransitDuration(hotelLat, hotelLng, finishLat, finishLng);
    transitDuration = transitResult?.duration ?? null;
  }

  return {
    distance_to_finish: distance,
    walking_duration: walkingResult?.duration ?? null,
    transit_duration: transitDuration,
  };
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}
