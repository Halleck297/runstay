import { useState, useEffect, useRef, useCallback } from "react";

interface Hotel {
  placeId: string;
  name: string;
  city: string;
  country: string;
  formattedAddress: string;
  lat?: number;
  lng?: number;
  rating?: number;
  website?: string;
}

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
}

interface HotelAutocompleteProps {
  onSelectHotel: (hotel: Hotel | null) => void;
  apiKey: string;
  eventCity?: string;
  eventCountry?: string;
  defaultHotelName?: string;
  hasError?: boolean;
}

export function HotelAutocomplete({ onSelectHotel, apiKey, eventCity, eventCountry, defaultHotelName, hasError }: HotelAutocompleteProps) {
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(() => {
    if (defaultHotelName) {
      return {
        placeId: "",
        name: defaultHotelName,
        city: "",
        country: "",
        formattedAddress: "",
      };
    }
    return null;
  });
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTokenRef = useRef<string>(generateSessionToken());

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions using Places API (New) - Autocomplete endpoint
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!apiKey || !query.trim()) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);

    try {
      // Build the request for Places API (New) Autocomplete
      const requestBody: any = {
        input: query,
        includedPrimaryTypes: ["lodging"],
        sessionToken: sessionTokenRef.current,
      };

      // Add location bias if we have event city/country
      if (eventCity && eventCountry) {
        // Use text-based location restriction
        requestBody.includedRegionCodes = [getCountryCode(eventCountry)].filter(Boolean);
      } else if (eventCountry) {
        requestBody.includedRegionCodes = [getCountryCode(eventCountry)].filter(Boolean);
      }

      const response = await fetch(
        `https://places.googleapis.com/v1/places:autocomplete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch suggestions");
      }

      const data = await response.json();

      if (data.suggestions) {
        // Map and sort suggestions - prioritize event city
        const mappedSuggestions: Suggestion[] = data.suggestions
          .filter((s: any) => s.placePrediction)
          .map((s: any) => ({
            placeId: s.placePrediction.placeId,
            mainText: s.placePrediction.structuredFormat?.mainText?.text || s.placePrediction.text?.text || "",
            secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text || "",
            fullText: s.placePrediction.text?.text || "",
          }));

        // Sort to prioritize hotels in event city
        const sortedSuggestions = [...mappedSuggestions].sort((a, b) => {
          if (eventCity) {
            const aInCity = a.secondaryText.toLowerCase().includes(eventCity.toLowerCase());
            const bInCity = b.secondaryText.toLowerCase().includes(eventCity.toLowerCase());
            if (aInCity && !bInCity) return -1;
            if (!aInCity && bInCity) return 1;
          }
          return 0;
        });

        setSuggestions(sortedSuggestions);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, eventCity, eventCountry]);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setIsOpen(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  // Handle suggestion selection - fetch place details
  const handleSelectSuggestion = async (suggestion: Suggestion) => {
    setIsLoading(true);

    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${suggestion.placeId}?fields=id,displayName,formattedAddress,addressComponents,location,rating,websiteUri&sessionToken=${sessionTokenRef.current}`,
        {
          headers: {
            "X-Goog-Api-Key": apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch place details");
      }

      const place = await response.json();

      let city = "";
      let country = "";

      place.addressComponents?.forEach((component: any) => {
        if (component.types?.includes("locality")) {
          city = component.longText || "";
        }
        if (component.types?.includes("country")) {
          country = component.longText || "";
        }
      });

      const hotel: Hotel = {
        placeId: place.id || suggestion.placeId,
        name: place.displayName?.text || suggestion.mainText,
        city,
        country,
        formattedAddress: place.formattedAddress || "",
        lat: place.location?.latitude,
        lng: place.location?.longitude,
        rating: place.rating,
        website: place.websiteUri,
      };

      setSelectedHotel(hotel);
      onSelectHotel(hotel);
      setInputValue("");
      setSuggestions([]);
      setIsOpen(false);

      // Generate new session token for next search
      sessionTokenRef.current = generateSessionToken();
    } catch (error) {
      console.error("Error fetching place details:", error);
      // Fallback: use suggestion data
      const hotel: Hotel = {
        placeId: suggestion.placeId,
        name: suggestion.mainText,
        city: "",
        country: "",
        formattedAddress: suggestion.fullText,
      };
      setSelectedHotel(hotel);
      onSelectHotel(hotel);
      setInputValue("");
      setSuggestions([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = () => {
    setSelectedHotel(null);
    onSelectHotel(null);
    setInputValue("");
    setSuggestions([]);
  };

  const handleManualSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const manualHotel: Hotel = {
      placeId: "",
      name: formData.get("manualHotelName") as string,
      city: formData.get("manualCity") as string,
      country: formData.get("manualCountry") as string,
      formattedAddress: "",
    };

    setSelectedHotel(manualHotel);
    onSelectHotel(manualHotel);
    setShowManualForm(false);
  };

  // Check if a suggestion is in the event city
  const isInEventCity = (suggestion: Suggestion): boolean => {
    if (!eventCity) return false;
    return suggestion.secondaryText.toLowerCase().includes(eventCity.toLowerCase());
  };

  return (
    <div>
      {!selectedHotel ? (
        <div className="space-y-3">
          {/* Hidden inputs for form submission */}
          <input type="hidden" name="hotelPlaceId" value="" />
          <input type="hidden" name="hotelName" value="" />
          <input type="hidden" name="hotelCity" value="" />
          <input type="hidden" name="hotelCountry" value="" />
          <input type="hidden" name="hotelLat" value="" />
          <input type="hidden" name="hotelLng" value="" />
          <input type="hidden" name="hotelRating" value="" />
          <input type="hidden" name="hotelWebsite" value="" />

          {/* Custom Autocomplete Input */}
          <div ref={dropdownRef} className="relative">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => inputValue && setIsOpen(true)}
                placeholder={eventCity ? `Search hotels in ${eventCity}...` : "Search hotel name or city..."}
                className={`w-full pl-10 pr-4 py-3 border rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors ${
                  hasError ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"
                }`}
                autoComplete="off"
              />
              {isLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Dropdown */}
            {isOpen && suggestions.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-[60vh] md:max-h-80 overflow-y-auto">
                {eventCity && suggestions.some(s => isInEventCity(s)) && (
                  <div className="px-3 py-2 bg-brand-50 border-b border-brand-100">
                    <p className="text-xs font-medium text-brand-700">
                      Hotels in {eventCity}
                    </p>
                  </div>
                )}
                {suggestions.map((suggestion, index) => {
                  const inCity = isInEventCity(suggestion);
                  // Show separator before first non-city result
                  const showSeparator = eventCity &&
                    index > 0 &&
                    isInEventCity(suggestions[index - 1]) &&
                    !inCity;

                  return (
                    <div key={suggestion.placeId}>
                      {showSeparator && (
                        <div className="px-3 py-2 bg-gray-50 border-t border-b border-gray-100">
                          <p className="text-xs font-medium text-gray-500">
                            Other locations
                          </p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                          inCity ? "bg-brand-50/50" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <svg
                            className={`h-5 w-5 mt-0.5 flex-shrink-0 ${inCity ? "text-brand-500" : "text-gray-400"}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <div className="min-w-0 flex-1">
                            <p className={`font-medium truncate ${inCity ? "text-brand-900" : "text-gray-900"}`}>
                              {suggestion.mainText}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {suggestion.secondaryText}
                            </p>
                          </div>
                          {inCity && (
                            <span className="flex-shrink-0 px-2 py-0.5 bg-brand-100 text-brand-700 text-xs font-medium rounded-full">
                              Event city
                            </span>
                          )}
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* No results message */}
            {isOpen && inputValue && suggestions.length === 0 && !isLoading && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-4">
                <p className="text-sm text-gray-500 text-center">
                  No hotels found. Try a different search or add manually.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowManualForm(!showManualForm)}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            {showManualForm ? (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Use search instead
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Can't find your hotel? Add manually
              </>
            )}
          </button>

          {showManualForm && (
            <form onSubmit={handleManualSubmit} className="mt-4 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div>
                <label htmlFor="manualHotelName" className="label text-sm">
                  Hotel name *
                </label>
                <input
                  type="text"
                  id="manualHotelName"
                  name="manualHotelName"
                  required
                  className="input"
                  placeholder="e.g. Hotel Artemide"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="manualCity" className="label text-sm">
                    City *
                  </label>
                  <input
                    type="text"
                    id="manualCity"
                    name="manualCity"
                    required
                    className="input"
                    placeholder="e.g. Rome"
                    defaultValue={eventCity}
                  />
                </div>
                <div>
                  <label htmlFor="manualCountry" className="label text-sm">
                    Country *
                  </label>
                  <input
                    type="text"
                    id="manualCountry"
                    name="manualCountry"
                    required
                    className="input"
                    placeholder="e.g. Italy"
                    defaultValue={eventCountry}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="rounded-full bg-accent-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-accent-500/30 hover:bg-accent-600 transition-colors">
                  Save hotel
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualForm(false)}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="flex items-start sm:items-center justify-between gap-3 rounded-xl border border-green-500 bg-green-50 p-4">
          {/* Hidden inputs quando hotel è selezionato */}
          <input type="hidden" name="hotelPlaceId" value={selectedHotel?.placeId || ""} />
          <input type="hidden" name="hotelName" value={selectedHotel?.name || ""} />
          <input type="hidden" name="hotelCity" value={selectedHotel?.city || ""} />
          <input type="hidden" name="hotelCountry" value={selectedHotel?.country || ""} />
          <input type="hidden" name="hotelLat" value={selectedHotel?.lat || ""} />
          <input type="hidden" name="hotelLng" value={selectedHotel?.lng || ""} />
          <input type="hidden" name="hotelRating" value={selectedHotel?.rating || ""} />
          <input type="hidden" name="hotelWebsite" value={selectedHotel?.website || ""} />

          <div className="flex items-start gap-3 min-w-0">
            <svg className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 break-words">
                {selectedHotel.name}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {selectedHotel.city}{selectedHotel.country ? `, ${selectedHotel.country}` : ""}
                {selectedHotel.rating && ` • ⭐ ${selectedHotel.rating}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleChange}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium flex-shrink-0"
          >
            Change
          </button>
        </div>
      )}
    </div>
  );
}

// Generate a random session token for Places API billing optimization
function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Helper to convert country name to ISO code for Google API
function getCountryCode(countryName: string): string {
  const countryMap: Record<string, string> = {
    "Italy": "it",
    "Germany": "de",
    "USA": "us",
    "United States": "us",
    "UK": "gb",
    "United Kingdom": "gb",
    "France": "fr",
    "Spain": "es",
    "Japan": "jp",
    "Netherlands": "nl",
    "Greece": "gr",
    "Portugal": "pt",
    "Austria": "at",
    "Switzerland": "ch",
    "Belgium": "be",
    "Poland": "pl",
    "Czech Republic": "cz",
    "Sweden": "se",
    "Norway": "no",
    "Denmark": "dk",
    "Finland": "fi",
    "Ireland": "ie",
    "Australia": "au",
    "Canada": "ca",
    "Brazil": "br",
    "Argentina": "ar",
    "Mexico": "mx",
    "South Africa": "za",
    "Kenya": "ke",
    "Morocco": "ma",
    "Egypt": "eg",
    "China": "cn",
    "South Korea": "kr",
    "Singapore": "sg",
    "Thailand": "th",
    "Malaysia": "my",
    "Indonesia": "id",
    "Vietnam": "vn",
    "India": "in",
    "United Arab Emirates": "ae",
    "Israel": "il",
    "Turkey": "tr",
    "Russia": "ru",
    "New Zealand": "nz",
  };

  return countryMap[countryName] || "";
}
