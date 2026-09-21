"use client";

import { useRef } from "react";

export function OtpInput({
  value,
  onChange,
  onEnter,
  disabled = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  onEnter?: () => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function setDigit(idx: number, raw: string) {
    const code = raw.replace(/\D/g, "");
    if (code.length > 1) {
      onChange(Array.from({ length: value.length }, (_, i) => code[i] ?? ""));
      refs.current[Math.min(code.length, value.length - 1)]?.focus();
      return;
    }
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...value];
    next[idx] = digit;
    onChange(next);
    if (digit && idx < value.length - 1) refs.current[idx + 1]?.focus();
  }

  return (
    <div className="flex gap-[9px] justify-between">
      {value.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => {
            refs.current[idx] = el;
          }}
          className="text-center outline-none transition-[border-color] duration-150"
          style={{
            width: 46,
            height: 56,
            background: "var(--panel-2)",
            border: `1px solid ${digit ? "rgba(95, 212, 255, 0.4)" : "rgba(140, 147, 163, 0.2)"}`,
            borderRadius: 11,
            fontFamily: "var(--font-mono)",
            fontSize: 22,
            color: "var(--white)",
          }}
          inputMode="numeric"
          disabled={disabled}
          autoComplete={idx === 0 ? "one-time-code" : "off"}
          maxLength={idx === 0 ? value.length : 1}
          aria-label={`หลักที่ ${idx + 1}`}
          value={digit}
          onPaste={(event) => {
            event.preventDefault();
            const code = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, value.length);
            if (!code) return;
            onChange(Array.from({ length: value.length }, (_, i) => code[i] ?? ""));
            refs.current[Math.min(code.length, value.length - 1)]?.focus();
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--cyan)")}
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = digit
              ? "rgba(95, 212, 255, 0.4)"
              : "rgba(140, 147, 163, 0.2)")
          }
          onChange={(e) => setDigit(idx, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[idx] && idx > 0) refs.current[idx - 1]?.focus();
            if (e.key === "Enter") onEnter?.();
          }}
        />
      ))}
    </div>
  );
}
