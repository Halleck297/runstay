import { useEffect, useRef, useState } from "react";
import { LOCALE_FLAGS, LOCALE_LABELS } from "~/lib/locale";
import type { SupportedLocale } from "~/lib/locale";

interface LocaleSwitcherProps {
  value: SupportedLocale;
  onChange: (locale: SupportedLocale) => void;
  buttonClassName?: string;
  menuClassName?: string;
}

export function LocaleSwitcher({
  value,
  onChange,
  buttonClassName = "",
  menuClassName = "",
}: LocaleSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", onDocClick);
      document.addEventListener("touchstart", onDocClick as any);
    }

    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick as any);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative z-50">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen((open) => !open);
        }}
        className={`inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 ${buttonClassName}`}
      >
        <span aria-hidden>{LOCALE_FLAGS[value]}</span>
        <span className="font-medium">{value.toUpperCase()}</span>
        <svg className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          onClick={(event) => event.stopPropagation()}
          className={`absolute right-0 mt-2 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg z-[60] ${menuClassName}`}
        >
          {(Object.keys(LOCALE_LABELS) as SupportedLocale[]).map((locale) => {
            const active = locale === value;
            return (
              <button
                key={locale}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setIsOpen(false);
                  if (!active) onChange(locale);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${active ? "text-brand-700" : "text-gray-700"}`}
              >
                <span aria-hidden>{LOCALE_FLAGS[locale]}</span>
                <span className="flex-1">{LOCALE_LABELS[locale]}</span>
                {active && (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
