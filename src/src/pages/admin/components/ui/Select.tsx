import { useEffect, useRef, useState } from "react";

export type SelectOption = {
  label: string;
  value: string;
  meta?: string;
};

interface SelectProps {
  options: SelectOption[];
  value: string | null;
  placeholder?: string;
  onChange: (value: string) => void;
}

function Select({ options, value, placeholder, onChange }: SelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="admin-select-custom" ref={containerRef}>
      <button
        type="button"
        className="admin-select-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>
          {selected ? selected.label : placeholder ?? "Select an option"}
        </span>
        {selected?.meta ? (
          <span className="admin-select-meta">· {selected.meta}</span>
        ) : null}
      </button>
      {open ? (
        <div className="admin-select-list" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`admin-select-option$${
                option.value === value ? " is-selected" : ""
              }`.replace("$", "")}
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.meta ? (
                <span className="admin-select-meta">· {option.meta}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { Select };
