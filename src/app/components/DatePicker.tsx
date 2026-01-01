import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { format, isValid, parseISO } from "date-fns";
import "react-day-picker/dist/style.css";

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
};

function DatePicker({ value, onChange, placeholder, min }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const selectedDate = value ? parseISO(value) : undefined;
  const minDate = min ? parseISO(min) : undefined;
  const currentYear = new Date().getFullYear();
  const minYear =
    minDate && isValid(minDate)
      ? minDate.getFullYear()
      : Math.min(2004, currentYear - 10);
  const maxYear = currentYear + 5;
  const [displayMonth, setDisplayMonth] = useState<Date>(
    selectedDate ?? new Date()
  );
  const displayYear = displayMonth.getFullYear();
  const displayMonthIndex = displayMonth.getMonth();
  const formattedValue =
    selectedDate && isValid(selectedDate)
      ? format(selectedDate, "yyyy/MM/dd")
      : "";
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const years = Array.from(
    { length: maxYear - minYear + 1 },
    (_, index) => maxYear - index
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      setMonthOpen(false);
      setYearOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setDisplayMonth(selectedDate ?? new Date());
      setMonthOpen(false);
      setYearOpen(false);
    }
  }, [open, selectedDate]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target || !containerRef.current) return;
      if (containerRef.current.contains(target)) return;
      setOpen(false);
      setMonthOpen(false);
      setYearOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  return (
    <div className="date-picker" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="date-trigger"
        onClick={() =>
          setOpen((prev) => {
            if (prev) {
              setMonthOpen(false);
              setYearOpen(false);
            }
            return !prev;
          })
        }
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{formattedValue || placeholder || "Select a date"}</span>
        <span className="date-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M8 3v3" />
            <path d="M16 3v3" />
            <rect x="4" y="6" width="16" height="14" rx="2" />
            <path d="M4 10h16" />
          </svg>
        </span>
      </button>
      {open ? (
        <div
          ref={popoverRef}
          className="date-popover"
          role="dialog"
          aria-label="Select date"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="date-picker__header">
            <div className="date-picker__month">
              <button
                type="button"
                className="date-picker__month-button"
                onClick={() => {
                  setYearOpen(false);
                  setMonthOpen((prev) => !prev);
                }}
                aria-haspopup="listbox"
                aria-expanded={monthOpen}
              >
                {monthNames[displayMonthIndex]}
              </button>
              {monthOpen ? (
                <div
                  className="date-picker__month-menu"
                  role="listbox"
                >
                  {monthNames.map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      className={`date-picker__month-option${
                        index === displayMonthIndex ? " is-active" : ""
                      }`}
                      role="option"
                      aria-selected={index === displayMonthIndex}
                      onClick={() => {
                        setDisplayMonth(new Date(displayYear, index, 1));
                        setMonthOpen(false);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="date-picker__year">
              <button
                type="button"
                className="date-picker__year-button"
                onClick={() => {
                  setMonthOpen(false);
                  setYearOpen((prev) => !prev);
                }}
                aria-haspopup="listbox"
                aria-expanded={yearOpen}
              >
                {displayYear}
              </button>
              {yearOpen ? (
                <div
                  className="date-picker__year-menu"
                  role="listbox"
                >
                  {years.map((year) => (
                    <button
                      key={year}
                      type="button"
                      className={`date-picker__year-option${
                        year === displayYear ? " is-active" : ""
                      }`}
                      role="option"
                      aria-selected={year === displayYear}
                      onClick={() => {
                        setDisplayMonth(
                          new Date(year, displayMonthIndex, 1)
                        );
                        setYearOpen(false);
                      }}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {value ? (
              <button
                type="button"
                className="date-picker__clear"
                onClick={() => {
                  onChange("");
                  setMonthOpen(false);
                  setYearOpen(false);
                }}
                aria-label="Clear selected date"
              >
                Clear
              </button>
            ) : null}
          </div>
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (!date) return;
              onChange(format(date, "yyyy-MM-dd"));
              setOpen(false);
            }}
            disabled={minDate && isValid(minDate) ? { before: minDate } : undefined}
            weekStartsOn={1}
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            captionLayout="dropdown"
          />
        </div>
      ) : null}
    </div>
  );
}

export { DatePicker };
