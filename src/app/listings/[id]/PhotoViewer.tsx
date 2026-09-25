"use client";

import { useRef, useState } from "react";

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
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const url = face === "front" ? frontUrl : backUrl;
  const alt = `${name} — ${face === "front" ? "ด้านหน้า" : "ด้านหลัง"}`;

  return (
    <div>
      {/* Real card proportions (63 × 88) with object-contain: the whole photo, corners and edges included, is condition evidence. */}
      <div
        className="relative mx-auto flex items-center justify-center overflow-hidden rounded-[18px]"
        style={{ aspectRatio: "63 / 88", maxWidth: 340, background: "var(--panel-2)", border: "1px solid var(--cyan-line)" }}
      >
        <span
          className="mono absolute right-[14px] top-[14px] z-[2] rounded-full px-[9px] py-[3px] text-[11px]"
          style={{ color: "var(--cyan)", background: "var(--cyan-tint)", border: "1px solid var(--cyan-line)" }}
        >
          {rarity}
        </span>

        {url ? (
          <button
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            aria-label={`ขยายรูป${face === "front" ? "ด้านหน้า" : "ด้านหลัง"}`}
            className="group absolute inset-0 cursor-zoom-in border-0 bg-transparent p-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={alt} fetchPriority="high" className="h-full w-full object-contain" />
            <span
              className="absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-full opacity-80 transition-opacity group-hover:opacity-100"
              style={{ background: "color-mix(in srgb, var(--bg) 75%, transparent)", color: "var(--white)" }}
              aria-hidden="true"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="m12.6 12.6 4 4M8.5 6.2v4.6M6.2 8.5h4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
          </button>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {face === "back" && <CircuitBack />}
            <svg className="relative z-[1]" style={{ width: "30%", height: "30%" }} viewBox="0 0 64 64" aria-hidden="true">
              <path
                d={face === "front" ? "M32 4 L40 28 L64 28 L44 42 L52 64 L32 50 L12 64 L20 42 L0 28 L24 28 Z" : "M32 6 L40.8 25.2 L32 44.4 L23.2 25.2 Z"}
                fill="var(--cyan)"
              />
            </svg>
            <span className="relative z-[1] mt-3 text-[15px] font-bold tracking-[0.03em]" style={{ fontFamily: "var(--font-display)" }}>
              {face === "front" ? name : "TCS"}
            </span>
            {face === "front" && (
              <span className="mono relative z-[1] mt-1 text-[11px]" style={{ color: "var(--steel)" }}>
                {setName}
              </span>
            )}
            <span className="mono absolute inset-x-0 bottom-4 z-[1] text-center text-[10.5px]" style={{ color: "var(--steel)", letterSpacing: "0.04em" }}>
              {face === "front" ? "ด้านหน้า · Front" : "ด้านหลัง · Back"}
            </span>
          </div>
        )}
      </div>

      <div className="mt-[14px] flex justify-center gap-[10px]">
        {(["front", "back"] as const).map((f) => {
          const thumb = f === "front" ? frontUrl : backUrl;
          return (
            <button
              key={f}
              type="button"
              aria-label={f === "front" ? "ดูรูปด้านหน้า" : "ดูรูปด้านหลัง"}
              aria-pressed={face === f}
              onClick={() => setFace(f)}
              className="relative flex items-center justify-center overflow-hidden rounded-[10px] p-0"
              style={{
                width: 58,
                height: 81,
                background: "var(--panel-2)",
                border: `1.5px solid ${face === f ? "var(--cyan)" : "var(--line)"}`,
                opacity: face === f ? 1 : 0.6,
              }}
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <>
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
                </>
              )}
              <span
                className="mono absolute inset-x-0 bottom-0 pb-1 pt-3 text-center text-[9px]"
                style={{ color: "var(--white)", background: "linear-gradient(to top, color-mix(in srgb, var(--bg) 85%, transparent), transparent)" }}
              >
                {f === "front" ? "หน้า" : "หลัง"}
              </span>
            </button>
          );
        })}
      </div>

      {url && (
        <dialog
          ref={dialogRef}
          aria-label={alt}
          onClick={() => dialogRef.current?.close()}
          className="m-auto max-h-none max-w-none cursor-zoom-out overflow-visible border-0 bg-transparent p-0 backdrop:bg-[color-mix(in_srgb,var(--bg)_92%,transparent)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={alt} className="block max-h-[88vh] max-w-[92vw] rounded-xl object-contain" />
          <button
            type="button"
            aria-label="ปิด"
            className="absolute -right-3 -top-3 flex size-11 items-center justify-center rounded-full"
            style={{ background: "var(--panel-2)", color: "var(--white)", border: "1px solid var(--line)" }}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </dialog>
      )}
    </div>
  );
}
