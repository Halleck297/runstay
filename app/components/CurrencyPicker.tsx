import { useState, useRef, useEffect } from "react";

const CURRENCIES = [
  { value: "EUR", symbol: "€", label: "Euro" },
  { value: "USD", symbol: "$", label: "US Dollar" },
  { value: "GBP", symbol: "£", label: "British Pound" },
  { value: "JPY", symbol: "¥", label: "Japanese Yen" },
  { value: "CAD", symbol: "$", label: "Canadian Dollar" },
  { value: "CHF", symbol: "CHF", label: "Swiss Franc" },
  { value: "AUD", symbol: "$", label: "Australian Dollar" },
];

interface CurrencyPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function CurrencyPicker({ value, onChange }: CurrencyPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedCurrency = CURRENCIES.find((c) => c.value === value) || CURRENCIES[0];

  return (
    <div ref={dropdownRef} className="relative">
      {/* Hidden input for form submission */}
      <input type="hidden" name="currency" value={value} />

      {/* Dropdown trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input w-fit flex items-center gap-2 text-gray-900"
      >
        <span className="font-medium">{selectedCurrency.value}</span>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 w-full rounded-lg bg-white shadow-[0_4px_16px_rgba(0,0,0,0.15)] border border-gray-100 py-1">
          {CURRENCIES.map((currency) => (
            <button
              key={currency.value}
              type="button"
              onClick={() => {
                onChange(currency.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                value === currency.value
                  ? "text-gray-900 font-medium"
                  : "text-gray-700"
              }`}
            >
              <span>{currency.value}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
