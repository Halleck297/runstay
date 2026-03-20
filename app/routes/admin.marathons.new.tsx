import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, useActionData, useLoaderData, useNavigate } from "react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { requireAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { buildGeoI18nFromPlaceId } from "~/lib/geo-i18n.server";
import { buildCountryI18nFromCode, countryNameToCode } from "~/lib/geo-i18n.server";
import { DatePicker } from "~/components/DatePicker";

export const meta: MetaFunction = () => [{ title: "Add Marathon - Admin - Runoot" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  return {};
}

export async function action({ request }: ActionFunctionArgs) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();

  const name = String(formData.get("name") || "").trim();
  const eventDate = String(formData.get("eventDate") || "").trim();
  const cityPlaceId = String(formData.get("cityPlaceId") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const country = String(formData.get("country") || "").trim();
  const finishLat = String(formData.get("finishLat") || "").trim();
  const finishLng = String(formData.get("finishLng") || "").trim();

  if (!name) return data({ error: "Event name is required." }, { status: 400 });
  if (!eventDate) return data({ error: "Event date is required." }, { status: 400 });
  if (!location && !cityPlaceId) return data({ error: "Please select a city." }, { status: 400 });

  // Build i18n translations
  let locationI18n: Record<string, string> = {};
  let countryI18n: Record<string, string> = {};
  let finalLocation = location;
  let finalCountry = country;

  if (cityPlaceId) {
    const geo = await buildGeoI18nFromPlaceId(cityPlaceId);
    locationI18n = geo.cityI18n;
    countryI18n = geo.countryI18n;
    if (geo.cityEn) finalLocation = geo.cityEn;
    if (geo.countryEn) finalCountry = geo.countryEn;
  } else if (country) {
    // Try to translate country from name even without placeId
    const code = countryNameToCode(country);
    if (code) countryI18n = buildCountryI18nFromCode(code);
  }

  // Generate slug
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const { data: existing } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    return data({ error: `An event with slug "${slug}" already exists.` }, { status: 400 });
  }

  const { data: newEvent, error: insertError } = await supabaseAdmin
    .from("events")
    .insert({
      name,
      slug,
      location: finalLocation || null,
      location_i18n: Object.keys(locationI18n).length > 0 ? locationI18n : null,
      country: finalCountry || "TBD",
      country_i18n: Object.keys(countryI18n).length > 0 ? countryI18n : null,
      event_date: eventDate,
      finish_lat: finishLat ? parseFloat(finishLat) : null,
      finish_lng: finishLng ? parseFloat(finishLng) : null,
      created_by: (admin as any).id,
    } as any)
    .select("id")
    .single();

  if (insertError || !newEvent) {
    return data({ error: `Failed to create event: ${insertError?.message || "unknown"}` }, { status: 400 });
  }

  return redirect("/admin/marathons");
}

export default function AdminMarathonsNew() {
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();

  // City autocomplete state
  const [cityInput, setCityInput] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCity, setSelectedCity] = useState<{
    placeId: string;
    name: string;
    country: string;
  } | null>(null);
  const [i18nPreview, setI18nPreview] = useState<{
    cityI18n: Record<string, string>;
    countryI18n: Record<string, string>;
  } | null>(null);
  const [loadingI18n, setLoadingI18n] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.length < 2) {
      setCitySuggestions([]);
      return;
    }
    try {
      const res = await fetch("/api/places/city", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await res.json();
      setCitySuggestions(data.suggestions || []);
      setShowSuggestions(true);
    } catch {
      setCitySuggestions([]);
    }
  }, []);

  const handleCityInputChange = (value: string) => {
    setCityInput(value);
    setSelectedCity(null);
    setI18nPreview(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const handleSelectCity = async (suggestion: any) => {
    const placeId = suggestion.placePrediction?.placeId;
    const mainText = suggestion.placePrediction?.structuredFormat?.mainText?.text || "";
    const secondaryText = suggestion.placePrediction?.structuredFormat?.secondaryText?.text || "";

    setCityInput(mainText);
    setSelectedCity({ placeId, name: mainText, country: secondaryText });
    setShowSuggestions(false);
    setCitySuggestions([]);

    // Fetch i18n translations
    if (placeId) {
      setLoadingI18n(true);
      try {
        const res = await fetch(`/api/places/geo-i18n?placeId=${encodeURIComponent(placeId)}`);
        const geo = await res.json();
        setI18nPreview({
          cityI18n: geo.cityI18n || {},
          countryI18n: geo.countryI18n || {},
        });
      } catch {
        setI18nPreview(null);
      } finally {
        setLoadingI18n(false);
      }
    }
  };

  const localeFlags: Record<string, string> = {
    en: "\u{1F1EC}\u{1F1E7}", de: "\u{1F1E9}\u{1F1EA}", fr: "\u{1F1EB}\u{1F1F7}",
    it: "\u{1F1EE}\u{1F1F9}", es: "\u{1F1EA}\u{1F1F8}", nl: "\u{1F1F3}\u{1F1F1}", pt: "\u{1F1F5}\u{1F1F9}",
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Add Marathon</h1>
          <p className="mt-1 text-sm text-gray-500">
            Select a city and the translations will be generated automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/marathons")}
          className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
      </div>

      {actionData && typeof actionData === "object" && "error" in actionData && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionData.error as string}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <Form method="post" className="space-y-6">
          {/* Hidden fields for city data */}
          <input type="hidden" name="cityPlaceId" value={selectedCity?.placeId || ""} />
          <input type="hidden" name="location" value={i18nPreview?.cityI18n?.en || selectedCity?.name || cityInput} />
          <input type="hidden" name="country" value={i18nPreview?.countryI18n?.en || selectedCity?.country || ""} />

          {/* Event name */}
          <div>
            <label className="label">Event name</label>
            <input
              name="name"
              className="input"
              placeholder="e.g. Barcelona Marathon"
              required
            />
          </div>

          {/* City search */}
          <div className="relative" ref={suggestionsRef}>
            <label className="label">City</label>
            <input
              type="text"
              className="input"
              placeholder="Start typing a city name..."
              value={cityInput}
              onChange={(e) => handleCityInputChange(e.target.value)}
              autoComplete="off"
            />
            {showSuggestions && citySuggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
                {citySuggestions.map((s: any, i: number) => (
                  <button
                    key={i}
                    type="button"
                    className="block w-full px-4 py-3 text-left text-sm hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl"
                    onClick={() => handleSelectCity(s)}
                  >
                    <span className="font-medium text-gray-900">
                      {s.placePrediction?.structuredFormat?.mainText?.text}
                    </span>
                    <span className="ml-2 text-gray-500">
                      {s.placePrediction?.structuredFormat?.secondaryText?.text}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {selectedCity && (
              <p className="mt-2 text-sm text-emerald-600">
                Selected: {selectedCity.name}, {selectedCity.country}
              </p>
            )}
          </div>

          {/* i18n preview */}
          {loadingI18n && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              Loading translations...
            </div>
          )}

          {i18nPreview && !loadingI18n && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="mb-3 text-sm font-semibold text-emerald-800">Auto-generated translations</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-emerald-600">City</p>
                  <div className="space-y-1">
                    {Object.entries(i18nPreview.cityI18n).map(([locale, name]) => (
                      <div key={locale} className="flex items-center gap-2 text-sm text-gray-700">
                        <span>{localeFlags[locale] || locale}</span>
                        <span className="font-mono text-xs text-gray-400">{locale}</span>
                        <span>{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-emerald-600">Country</p>
                  <div className="space-y-1">
                    {Object.entries(i18nPreview.countryI18n).map(([locale, name]) => (
                      <div key={locale} className="flex items-center gap-2 text-sm text-gray-700">
                        <span>{localeFlags[locale] || locale}</span>
                        <span className="font-mono text-xs text-gray-400">{locale}</span>
                        <span>{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Event date */}
          <div>
            <label className="label">Event date</label>
            <DatePicker
              name="eventDate"
              id="eventDate"
              placeholder="Select event date"
            />
          </div>

          {/* Finish line coordinates (optional) */}
          <div>
            <label className="label">Finish line coordinates (optional)</label>
            <div className="grid grid-cols-2 gap-3">
              <input
                name="finishLat"
                type="number"
                step="any"
                className="input"
                placeholder="Latitude"
              />
              <input
                name="finishLng"
                type="number"
                step="any"
                className="input"
                placeholder="Longitude"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Used for hotel distance calculations. Can be added later.
            </p>
          </div>

          <div className="flex items-center gap-3 border-t border-gray-200 pt-6">
            <button type="submit" className="btn-primary rounded-full px-6">
              Create Marathon
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin/marathons")}
              className="rounded-full border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
