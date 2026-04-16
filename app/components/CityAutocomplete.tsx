import { useState, useEffect, useRef, useCallback } from "react";
import { useI18n } from "~/hooks/useI18n";

interface CitySuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

interface CityAutocompleteProps {
  /** Current city name (for pre-filling) */
  defaultValue?: string;
  /** Current place_id (for pre-filling) */
  defaultPlaceId?: string;
  /** Name attribute for the city text hidden input */
  name?: string;
  /** Name attribute for the place_id hidden input */
  placeIdName?: string;
  /** Additional CSS class for the input */
  className?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Callback when a city is selected */
  onSelect?: (city: { name: string; placeId: string }) => void;
}

export function CityAutocomplete({
  defaultValue = "",
  defaultPlaceId = "",
  name = "city",
  placeIdName = "cityPlaceId",
  className = "",
  required = false,
  onSelect,
}: CityAutocompleteProps) {
  const { locale } = useI18n();
  const [inputValue, setInputValue] = useState(defaultValue);
  const [selectedCity, setSelectedCity] = useState(defaultValue);
  const [selectedPlaceId, setSelectedPlaceId] = useState(defaultPlaceId);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTokenRef = useRef(generateSessionToken());

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (query.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch("/api/places/city", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: query,
            language: locale,
            sessionToken: sessionTokenRef.current,
          }),
        });

        if (!response.ok) {
          setSuggestions([]);
          return;
        }

        const data = await response.json();
        setSuggestions(data.suggestions || []);
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [locale],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    // Clear selection when user types
    setSelectedCity("");
    setSelectedPlaceId("");
    setIsOpen(true);
    setHighlightIndex(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const handleSelect = (suggestion: CitySuggestion) => {
    const cityName = suggestion.mainText || suggestion.description;
    setInputValue(cityName);
    setSelectedCity(cityName);
    setSelectedPlaceId(suggestion.placeId);
    setSuggestions([]);
    setIsOpen(false);
    setHighlightIndex(-1);
    sessionTokenRef.current = generateSessionToken();
    onSelect?.({ name: cityName, placeId: suggestion.placeId });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
        handleSelect(suggestions[highlightIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleBlur = () => {
    // Small delay to allow click on suggestion
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setIsOpen(false);
        // If user typed but didn't select, keep the text as city name (no placeId)
        if (inputValue && !selectedCity) {
          setSelectedCity(inputValue);
        }
      }
    }, 200);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden inputs for form submission */}
      <input type="hidden" name={name} value={selectedCity || inputValue} />
      <input type="hidden" name={placeIdName} value={selectedPlaceId} />

      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => inputValue.length >= 2 && suggestions.length > 0 && setIsOpen(true)}
        onBlur={handleBlur}
        autoComplete="off"
        required={required}
        className={className}
        // Use a data attribute to signal the form that a city was selected via autocomplete
        data-place-id={selectedPlaceId || undefined}
      />

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-[50vh] md:max-h-64 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.placeId}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(suggestion)}
              className={`w-full px-4 py-2.5 text-left transition-colors border-b border-gray-50 last:border-b-0 ${
                index === highlightIndex ? "bg-brand-50" : "hover:bg-gray-50"
              }`}
            >
              <p className="text-sm font-medium text-gray-900">{suggestion.mainText}</p>
              {suggestion.secondaryText && (
                <p className="text-xs text-gray-500">{suggestion.secondaryText}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {isOpen && inputValue.length >= 2 && suggestions.length === 0 && !isLoading && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-3">
          <p className="text-xs text-gray-500 text-center">No cities found</p>
        </div>
      )}
    </div>
  );
}

function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}
