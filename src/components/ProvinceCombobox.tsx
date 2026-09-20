"use client";

import { useRef, useState, type CSSProperties } from "react";
import { THAI_PROVINCES } from "@/lib/thaiProvinces";

export function ProvinceCombobox({
  value,
  onChange,
  inputStyle,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  inputStyle: CSSProperties;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = value.trim();
  const filtered = query ? THAI_PROVINCES.filter((p) => p.includes(query)) : THAI_PROVINCES;

  function scheduleClose() {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    closeTimeout.current = setTimeout(() => setOpen(false), 150);
  }

  return (
    <div className="relative">
      <input
        style={inputStyle}
        value={value}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={scheduleClose}
      />
      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-10 max-h-[220px] overflow-y-auto rounded-[11px] py-[6px]"
          style={{ background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.22)", boxShadow: "0 20px 40px -12px rgba(0,0,0,0.5)" }}
        >
          {filtered.map((p) => (
            <li key={p}>
              <button
                type="button"
                role="option"
                aria-selected={p === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (closeTimeout.current) clearTimeout(closeTimeout.current);
                  onChange(p);
                  setOpen(false);
                }}
                className="block w-full px-[13px] py-[9px] text-left text-[14px]"
                style={{ background: p === value ? "rgba(95,212,255,0.08)" : "transparent", color: "var(--white)" }}
              >
                {p}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
