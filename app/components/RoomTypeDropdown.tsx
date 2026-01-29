import { useState, useRef, useEffect } from "react";

const ROOM_TYPES = [
  { value: "single", label: "Single" },
  { value: "double", label: "Double" },
  { value: "twin", label: "Twin" },
  { value: "twin_shared", label: "Twin Shared" },
  { value: "double_single_use", label: "Double Single Use" },
  { value: "triple", label: "Triple" },
  { value: "quadruple", label: "Quadruple" },
  { value: "other", label: "Other * (specify)" },
];

interface RoomTypeDropdownProps {
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
}

export function RoomTypeDropdown({ value, onChange, hasError }: RoomTypeDropdownProps) {
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

  const selectedOption = ROOM_TYPES.find((opt) => opt.value === value);

  return (
    <div ref={dropdownRef} className="relative">
      <label className="label mb-3">Room type</label>

      {/* Hidden input for form submission */}
      <input type="hidden" name="roomType" value={value} />

      {/* Dropdown trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`input w-fit min-w-[180px] text-left flex items-center justify-between gap-3 ${
          hasError ? "ring-1 ring-red-500" : ""
        } ${!value ? "text-gray-400" : "text-gray-900"}`}
      >
        <span>{selectedOption?.label || "Select type"}</span>
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-fit min-w-[180px] rounded-lg bg-white shadow-[0_4px_16px_rgba(0,0,0,0.15)] border border-gray-100 py-1 max-h-60 overflow-auto">
          {ROOM_TYPES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                value === option.value
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-gray-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
