import { useState, useRef, useEffect } from "react";
import { useI18n } from "~/hooks/useI18n";

interface SubjectDropdownProps {
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
}

export function SubjectDropdown({ value, onChange, hasError }: SubjectDropdownProps) {
  const { t } = useI18n();
  const SUBJECT_OPTIONS = [
    { value: "general", label: t("contact.subject.general") },
    { value: "bug", label: t("contact.subject.bug") },
    { value: "feature", label: t("contact.subject.feature") },
    { value: "partnership", label: t("contact.subject.partnership") },
    { value: "other", label: t("contact.subject.other") },
  ];
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

  const selectedOption = SUBJECT_OPTIONS.find((opt) => opt.value === value);

  return (
    <div ref={dropdownRef} className="relative">
      <label className="label text-base mb-6">{t("contact.subject")} *</label>

      {/* Hidden input for form submission */}
      <input type="hidden" name="subject" value={value} />

      {/* Dropdown trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`input shadow-md backdrop-blur-sm w-full text-left flex items-center justify-between gap-3 ${
          hasError ? "ring-1 ring-red-500" : ""
        } ${!value ? "text-gray-400" : "text-gray-900"}`}
      >
        <span>{selectedOption?.label || t("contact.subject_placeholder")}</span>
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
        <div className="absolute z-50 mt-1 w-full rounded-lg bg-white shadow-[0_4px_16px_rgba(0,0,0,0.15)] border border-gray-100 py-1 max-h-60 overflow-auto">
          {SUBJECT_OPTIONS.map((option) => (
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
