import { useState, forwardRef, useEffect } from "react";

interface DatePickerProps {
  name: string;
  id: string;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  defaultValue?: string;
  onChange?: (date: Date | null) => void;
}

export function DatePicker({
  name,
  id,
  placeholder = "dd/mm/yyyy",
  minDate,
  maxDate,
  defaultValue,
  onChange,
}: DatePickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    if (defaultValue) {
      return new Date(defaultValue);
    }
    return null;
  });
  const [ReactDatePicker, setReactDatePicker] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);

  // Dynamically import react-datepicker only on client side
  useEffect(() => {
    setIsClient(true);
    import("react-datepicker").then((mod) => {
      setReactDatePicker(() => mod.default);
    });
    // Import CSS
    import("react-datepicker/dist/react-datepicker.css");
  }, []);

  const handleChange = (date: Date | null) => {
    setSelectedDate(date);
    onChange?.(date);
  };

  // Format date to YYYY-MM-DD for form submission
  const formattedDate = selectedDate
    ? selectedDate.toISOString().split("T")[0]
    : "";

  // Format date for display (dd/mm/yyyy)
  const displayValue = selectedDate
    ? `${String(selectedDate.getDate()).padStart(2, "0")}/${String(selectedDate.getMonth() + 1).padStart(2, "0")}/${selectedDate.getFullYear()}`
    : "";

  // Custom input component - read only, only clickable to open picker
  const CustomInput = forwardRef<
    HTMLInputElement,
    { onClick?: () => void; placeholder?: string }
  >(({ onClick, placeholder: inputPlaceholder }, ref) => {
    return (
      <div className="relative w-40">
        <input
          type="text"
          className="input w-full pr-10 cursor-pointer"
          value={displayValue}
          onClick={onClick}
          readOnly
          placeholder={inputPlaceholder}
          ref={ref}
        />
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  });
  CustomInput.displayName = "CustomInput";

  // Show a placeholder input while loading or on server
  if (!isClient || !ReactDatePicker) {
    return (
      <div className="relative">
        <input type="hidden" name={name} value={formattedDate} />
        <div className="relative w-40">
          <input
            type="text"
            className="input w-full pr-10 cursor-pointer"
            value={displayValue}
            readOnly
            placeholder={placeholder}
          />
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={formattedDate} />

      <ReactDatePicker
        id={id}
        selected={selectedDate}
        onChange={handleChange}
        minDate={minDate}
        maxDate={maxDate}
        dateFormat="dd/MM/yyyy"
        placeholderText={placeholder}
        customInput={<CustomInput />}
        calendarClassName="custom-datepicker"
        popperClassName="datepicker-popper"
        showPopperArrow={false}
        closeOnScroll={true}
      />
    </div>
  );
}
