"use client";

import { useState } from "react";

const selectStyle = {
  background: "var(--panel-2)",
  border: "1px solid rgba(140,147,163,0.2)",
  color: "var(--white)",
} as const;

/**
 * Date + hour + minute dropdowns in Thai time (UTC+7), independent of the
 * browser's locale or timezone. Reports an ISO instant, or "" until a date is chosen.
 */
export function ThaiDateTimePicker({
  onChange,
  days = 14,
  defaultHour = "18",
}: {
  onChange: (iso: string) => void;
  /** How many days ahead are selectable (today included). */
  days?: number;
  defaultHour?: string;
}) {
  const [date, setDate] = useState("");
  const [hour, setHour] = useState(defaultHour);
  const [minute, setMinute] = useState("00");
  const [dates] = useState(() => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
    const [y, m, d] = today.split("-").map(Number);
    return Array.from({ length: days + 1 }, (_, i) => {
      const day = new Date(Date.UTC(y, m - 1, d + i));
      const label =
        i === 0
          ? "วันนี้"
          : i === 1
            ? "พรุ่งนี้"
            : day.toLocaleDateString("th-TH", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });
      return { value: day.toISOString().slice(0, 10), label };
    });
  });

  function emit(nextDate: string, nextHour: string, nextMinute: string) {
    onChange(nextDate ? `${nextDate}T${nextHour}:${nextMinute}:00+07:00` : "");
  }

  return (
    <div>
      <div className="grid grid-cols-[1.6fr_1fr_1fr] gap-2">
        <select
          aria-label="วันที่"
          value={date}
          onChange={(e) => { setDate(e.target.value); emit(e.target.value, hour, minute); }}
          className="min-h-11 rounded-[10px] px-3 text-[14px] outline-none"
          style={{ ...selectStyle, color: date ? "var(--white)" : "var(--steel-dim)" }}
        >
          <option value="">เลือกวันที่</option>
          {dates.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        <select
          aria-label="ชั่วโมง"
          value={hour}
          onChange={(e) => { setHour(e.target.value); emit(date, e.target.value, minute); }}
          className="min-h-11 rounded-[10px] px-3 text-[14px] outline-none"
          style={selectStyle}
        >
          {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")).map((h) => (
            <option key={h} value={h}>{h} น.</option>
          ))}
        </select>
        <select
          aria-label="นาที"
          value={minute}
          onChange={(e) => { setMinute(e.target.value); emit(date, hour, e.target.value); }}
          className="min-h-11 rounded-[10px] px-3 text-[14px] outline-none"
          style={selectStyle}
        >
          {["00", "15", "30", "45"].map((m) => (
            <option key={m} value={m}>{m} นาที</option>
          ))}
        </select>
      </div>
      {date && (
        <p className="mono mt-2 text-[13px]" style={{ color: "var(--cyan)" }}>
          {dates.find((d) => d.value === date)?.label} เวลา {hour}.{minute} น. (เวลาประเทศไทย)
        </p>
      )}
    </div>
  );
}
