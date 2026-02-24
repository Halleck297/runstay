import { useEffect, useRef, useState } from "react";

type TransferOption = {
  value: string;
  label: string;
};

interface TransferMethodDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: TransferOption[];
  placeholder: string;
  hasError?: boolean;
}

export function TransferMethodDropdown({
  value,
  onChange,
  options,
  placeholder,
  hasError,
}: TransferMethodDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <input type="hidden" name="transferType" value={value} />

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`input w-full text-left flex items-center justify-between gap-3 ${
          hasError ? "ring-1 ring-red-500" : ""
        } ${!value ? "text-gray-400" : "text-gray-900"}`}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-100 bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                value === option.value ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-700"
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
