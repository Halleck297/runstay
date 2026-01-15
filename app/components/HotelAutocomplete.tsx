/// <reference types="@types/google.maps" />

import { useState, useEffect, useRef } from "react";

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
}

export function HotelAutocomplete({ onSelectHotel, apiKey, eventCity, eventCountry }: HotelAutocompleteProps) {
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!inputRef.current || !apiKey) return;

    // Load Google Places API
    const loadGooglePlaces = async () => {
      if (!(window as any).google) {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);

        script.onload = () => {
          initAutocomplete();
        };
      } else {
        initAutocomplete();
      }
    };

    const initAutocomplete = () => {
      if (!inputRef.current) return;

      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ["lodging"],
        fields: ["place_id", "name", "formatted_address", "address_components", "geometry", "rating", "website"],
      });

         // Set location bias if event city is provided
      if (eventCity && eventCountry) {
        const countryCode = getCountryCode(eventCountry);
        if (countryCode) {
          autocompleteRef.current.setComponentRestrictions({
            country: countryCode,
          });
        }
      }
      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace();

        if (!place || !place.place_id) return;

        // Extract city and country from address_components
        let city = "";
        let country = "";

        place.address_components?.forEach((component: google.maps.GeocoderAddressComponent) => {
          if (component.types.includes("locality")) {
            city = component.long_name;
          }
          if (component.types.includes("country")) {
            country = component.long_name;
          }
        });

        const hotel: Hotel = {
          placeId: place.place_id,
          name: place.name || "",
          city,
          country,
          formattedAddress: place.formatted_address || "",
          lat: place.geometry?.location?.lat(),
          lng: place.geometry?.location?.lng(),
          rating: place.rating,
          website: place.website, 
        };

        setSelectedHotel(hotel);
        onSelectHotel(hotel);
      });
    };

    loadGooglePlaces();
  }, [apiKey, onSelectHotel]);

  const handleChange = () => {
    setSelectedHotel(null);
    onSelectHotel(null);
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
        {/* Hidden inputs for form submission - SPOSTATI QUI */}
        <input type="hidden" name="hotelPlaceId" value="" />
        <input type="hidden" name="hotelName" value="" />
        <input type="hidden" name="hotelCity" value="" />
        <input type="hidden" name="hotelCountry" value="" />
        <input type="hidden" name="hotelLat" value="" />
        <input type="hidden" name="hotelLng" value="" />
        <input type="hidden" name="hotelRating" value="" />
        <input type="hidden" name="hotelWebsite" value="" />
        
        <input
          ref={inputRef}
          type="text"
          placeholder="Start typing hotel name or city..."
          className="input"
          onChange={handleChange}
        />
          
                    <button
            type="button"
            onClick={() => setShowManualForm(!showManualForm)}
            className="mt-2 inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
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
                <button type="submit" className="btn-primary text-sm">
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
    // Add more as needed
  };
  
  return countryMap[countryName] || "";
}