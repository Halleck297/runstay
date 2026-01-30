/// <reference types="@types/google.maps" />

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

interface HotelAutocompleteProps {
  onSelectHotel: (hotel: Hotel | null) => void;
  apiKey: string;
  eventCity?: string;
  eventCountry?: string;
  defaultHotelName?: string;
  hasError?: boolean;
}

// Extend Window to include google maps types
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gmp-place-autocomplete': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        placeholder?: string;
        'country-codes'?: string;
      }, HTMLElement>;
    }
  }
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
  const [showManualForm, setShowManualForm] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<HTMLElement | null>(null);

  // Memoize the place select handler
  const handlePlaceSelect = useCallback(async (event: any) => {
    const place = event.place;

    if (!place) return;

    // Fetch additional fields
    await place.fetchFields({
      fields: ["id", "displayName", "formattedAddress", "addressComponents", "location", "rating", "websiteURI"],
    });

    // Extract city and country from address components
    let city = "";
    let country = "";

    place.addressComponents?.forEach((component: any) => {
      if (component.types.includes("locality")) {
        city = component.longText;
      }
      if (component.types.includes("country")) {
        country = component.longText;
      }
    });

    const hotel: Hotel = {
      placeId: place.id || "",
      name: place.displayName || "",
      city,
      country,
      formattedAddress: place.formattedAddress || "",
      lat: place.location?.lat(),
      lng: place.location?.lng(),
      rating: place.rating,
      website: place.websiteURI,
    };

    setSelectedHotel(hotel);
    onSelectHotel(hotel);
  }, [onSelectHotel]);

  useEffect(() => {
    if (!apiKey) return;

    const SCRIPT_ID = "google-maps-script";

    const initAutocomplete = () => {
      if (!containerRef.current || autocompleteRef.current) return;

      // Create the gmp-place-autocomplete element
      const autocomplete = document.createElement("gmp-place-autocomplete");
      autocomplete.setAttribute("placeholder", "Start typing hotel name or city...");

      // Set country restriction if available
      if (eventCountry) {
        const countryCode = getCountryCode(eventCountry);
        if (countryCode) {
          autocomplete.setAttribute("country-codes", countryCode);
        }
      }

      // Configure for lodging only
      (autocomplete as any).includedPrimaryTypes = ["lodging"];

      // Add event listener for place selection
      autocomplete.addEventListener("gmp-placeselect", handlePlaceSelect);

      // Style the container
      autocomplete.style.width = "100%";

      // Append to container
      containerRef.current.appendChild(autocomplete);
      autocompleteRef.current = autocomplete;
      setIsLoaded(true);
    };

    const loadGooglePlaces = () => {
      // Check if Google Maps is already fully loaded
      if ((window as any).google?.maps?.places?.PlaceAutocompleteElement) {
        initAutocomplete();
        return;
      }

      // Check if script already exists in DOM
      const existingScript = document.getElementById(SCRIPT_ID);

      if (existingScript) {
        // Script exists, wait for it to load
        if ((window as any).google?.maps?.places?.PlaceAutocompleteElement) {
          initAutocomplete();
        } else {
          existingScript.addEventListener("load", initAutocomplete);
        }
        return;
      }

      // Create and add script
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // Wait a bit for Google Maps to fully initialize
        const checkReady = setInterval(() => {
          if ((window as any).google?.maps?.places?.PlaceAutocompleteElement) {
            clearInterval(checkReady);
            initAutocomplete();
          }
        }, 100);
      };
      document.head.appendChild(script);
    };

    loadGooglePlaces();

    // Cleanup
    return () => {
      if (autocompleteRef.current) {
        autocompleteRef.current.removeEventListener("gmp-placeselect", handlePlaceSelect);
      }
    };
  }, [apiKey, eventCountry, handlePlaceSelect]);

  const handleChange = () => {
    setSelectedHotel(null);
    onSelectHotel(null);
    // Reset autocomplete
    if (autocompleteRef.current) {
      (autocompleteRef.current as any).value = "";
    }
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

          {/* Google Places Autocomplete Container */}
          <div
            ref={containerRef}
            className={`gmp-autocomplete-container ${hasError ? "has-error" : ""}`}
          />

          {!isLoaded && (
            <div className="input text-gray-400 animate-pulse">
              Loading hotel search...
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowManualForm(!showManualForm)}
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
          >
            {showManualForm ? (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Use autocomplete instead
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add hotel manually
              </>
            )}
          </button>

          {showManualForm && (
            <form onSubmit={handleManualSubmit} className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
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
        <div className="flex items-center justify-between rounded-lg border border-green-500 bg-green-50 p-4">
          {/* Hidden inputs quando hotel è selezionato */}
          <input type="hidden" name="hotelPlaceId" value={selectedHotel?.placeId || ""} />
          <input type="hidden" name="hotelName" value={selectedHotel?.name || ""} />
          <input type="hidden" name="hotelCity" value={selectedHotel?.city || ""} />
          <input type="hidden" name="hotelCountry" value={selectedHotel?.country || ""} />
          <input type="hidden" name="hotelLat" value={selectedHotel?.lat || ""} />
          <input type="hidden" name="hotelLng" value={selectedHotel?.lng || ""} />
          <input type="hidden" name="hotelRating" value={selectedHotel?.rating || ""} />
          <input type="hidden" name="hotelWebsite" value={selectedHotel?.website || ""} />

          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Hotel: {selectedHotel.name}
              </p>
              <p className="text-xs text-gray-600">
                {selectedHotel.city}{selectedHotel.country ? `, ${selectedHotel.country}` : ""}
                {selectedHotel.rating && ` • ⭐ ${selectedHotel.rating}`}
                {selectedHotel.website && ` • 🌐 Website available`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleChange}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Change
          </button>
        </div>
      )}

      {/* Styles for Google Places Autocomplete */}
      <style>{`
        .gmp-autocomplete-container {
          width: 100%;
        }
        .gmp-autocomplete-container gmp-place-autocomplete {
          width: 100%;
          --gmp-color-surface: #ffffff;
          --gmp-color-on-surface: #111827;
          --gmp-color-on-surface-variant: #6b7280;
          --gmp-color-primary: #16a34a;
          --gmp-color-outline: #d1d5db;
        }
        .gmp-autocomplete-container gmp-place-autocomplete::part(input) {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          line-height: 1.25rem;
          background-color: #ffffff;
          color: #111827;
          transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }
        .gmp-autocomplete-container gmp-place-autocomplete::part(input)::placeholder {
          color: #9ca3af;
        }
        .gmp-autocomplete-container gmp-place-autocomplete::part(input):focus {
          outline: none;
          border-color: #16a34a;
          box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.1);
        }
        .gmp-autocomplete-container.has-error gmp-place-autocomplete::part(input) {
          border-color: #ef4444;
          box-shadow: 0 0 0 1px #ef4444;
        }
        /* Force light theme on dropdown */
        gmp-place-autocomplete {
          color-scheme: light;
        }
      `}</style>
    </div>
  );
}

// Helper to convert country name to ISO code for Google API
function getCountryCode(countryName: string): string {
  const countryMap: Record<string, string> = {
    "Italy": "IT",
    "Germany": "DE",
    "USA": "US",
    "United States": "US",
    "UK": "GB",
    "United Kingdom": "GB",
    "France": "FR",
    "Spain": "ES",
    "Japan": "JP",
    "Netherlands": "NL",
    "Greece": "GR",
    "Portugal": "PT",
    "Austria": "AT",
    "Switzerland": "CH",
    "Belgium": "BE",
    "Poland": "PL",
    "Czech Republic": "CZ",
    "Sweden": "SE",
    "Norway": "NO",
    "Denmark": "DK",
    "Finland": "FI",
    "Ireland": "IE",
    "Australia": "AU",
    "Canada": "CA",
    "Brazil": "BR",
    "Argentina": "AR",
    "Mexico": "MX",
    "South Africa": "ZA",
    "Kenya": "KE",
    "Morocco": "MA",
    "Egypt": "EG",
    "China": "CN",
    "South Korea": "KR",
    "Singapore": "SG",
    "Thailand": "TH",
    "Malaysia": "MY",
    "Indonesia": "ID",
    "Vietnam": "VN",
    "India": "IN",
    "United Arab Emirates": "AE",
    "Israel": "IL",
    "Turkey": "TR",
    "Russia": "RU",
    "New Zealand": "NZ",
  };

  return countryMap[countryName] || "";
}
