"use client";

import { useState } from "react";

function CircuitBack() {
  return (
    <svg className="absolute inset-0 h-full w-full opacity-55" viewBox="0 0 220 308" aria-hidden="true">
      <g stroke="var(--cyan)" strokeWidth={1} opacity={0.55} fill="none">
        <circle cx="110" cy="140" r="46" />
        <circle cx="110" cy="140" r="70" />
        <path d="M110 70 L110 40 M110 210 L110 240 M40 140 L15 140 M180 140 L205 140" />
        <path d="M60 90 L35 65 M160 90 L185 65 M60 190 L35 215 M160 190 L185 215" />
      </g>
      <g stroke="var(--cyan)" strokeWidth={0.75} opacity={0.3} fill="none">
        <rect x="18" y="18" width="184" height="272" rx="12" />
      </g>
    </svg>
  );
}

export function PhotoViewer({
  name,
  setName,
  rarity,
  frontUrl,
  backUrl,
}: {
  name: string;
  setName: string;
  rarity: string;
  frontUrl: string | null;
  backUrl: string | null;
}) {
  const [face, setFace] = useState<"front" | "back">("front");

  return (
    <div className="lg:sticky lg:top-[90px]">
      <div
        className="relative mx-auto flex items-center justify-center overflow-hidden rounded-[18px]"
        style={{ aspectRatio: "5 / 6.2", maxWidth: 340, background: "var(--panel-2)", border: "1px solid rgba(95,212,255,0.18)" }}
      >
        <span
          className="mono absolute right-[14px] top-[14px] z-[2] rounded-full px-[9px] py-[3px] text-[11px]"
          style={{ color: "var(--cyan)", background: "rgba(95,212,255,0.1)", border: "1px solid rgba(95,212,255,0.3)" }}
        >
          {rarity}
        </span>

        {face === "front" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {frontUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={frontUrl} alt={`${name} — ด้านหน้า`} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <>
                <svg className="relative z-[1]" style={{ width: "30%", height: "30%" }} viewBox="0 0 64 64" aria-hidden="true">
                  <path d="M32 4 L40 28 L64 28 L44 42 L52 64 L32 50 L12 64 L20 42 L0 28 L24 28 Z" fill="var(--cyan)" />
                </svg>
                <span className="relative z-[1] mt-3 text-[15px] font-bold tracking-[0.03em]" style={{ fontFamily: "var(--font-display)" }}>
                  {name}
                </span>
                <span className="mono relative z-[1] mt-1 text-[11px]" style={{ color: "var(--steel)" }}>
                  {setName}
                </span>
                <span
                  className="mono absolute inset-x-0 bottom-4 z-[1] text-center text-[10.5px]"
                  style={{ color: "var(--steel-dim)", letterSpacing: "0.04em" }}
                >
                  ด้านหน้า · Front
                </span>
              </>
            )}
          </div>
        )}

        {face === "back" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {backUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={backUrl} alt={`${name} — ด้านหลัง`} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <>
                <CircuitBack />
                <svg className="relative z-[1]" style={{ width: "30%", height: "30%" }} viewBox="0 0 64 64" aria-hidden="true">
                  <path d="M32 6 L40.8 25.2 L32 44.4 L23.2 25.2 Z" fill="var(--cyan)" />
                </svg>
                <span className="relative z-[1] mt-3 text-[15px] font-bold tracking-[0.03em]" style={{ fontFamily: "var(--font-display)" }}>
                  TCS
                </span>
                <span
                  className="mono absolute inset-x-0 bottom-4 z-[1] text-center text-[10.5px]"
                  style={{ color: "var(--steel-dim)", letterSpacing: "0.04em" }}
                >
                  ด้านหลัง · Back
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-[14px] flex justify-center gap-[10px]">
        {(["front", "back"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-label={f === "front" ? "ดูรูปด้านหน้า" : "ดูรูปด้านหลัง"}
            onClick={() => setFace(f)}
            className="relative flex items-center justify-center overflow-hidden rounded-[10px] p-0"
            style={{
              width: 58,
              height: 72,
              background: "var(--panel-2)",
              border: `1.5px solid ${face === f ? "var(--cyan)" : "rgba(140,147,163,0.18)"}`,
            }}
          >
            {f === "back" && (
              <svg className="absolute inset-0 h-full w-full opacity-50" viewBox="0 0 64 64" aria-hidden="true">
                <g stroke="var(--cyan)" strokeWidth={1} opacity={0.5} fill="none">
                  <circle cx="32" cy="32" r="16" />
                </g>
              </svg>
            )}
            <svg className="relative opacity-90" style={{ width: "40%", height: "40%" }} viewBox="0 0 64 64" aria-hidden="true">
              <path
                d={f === "front" ? "M32 4 L40 28 L64 28 L44 42 L52 64 L32 50 L12 64 L20 42 L0 28 L24 28 Z" : "M32 6 L40.8 25.2 L32 44.4 L23.2 25.2 Z"}
                fill="var(--cyan)"
              />
            </svg>
            <span className="mono absolute inset-x-0 bottom-1 text-center text-[9px]" style={{ color: "var(--steel)" }}>
              {f === "front" ? "หน้า" : "หลัง"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
