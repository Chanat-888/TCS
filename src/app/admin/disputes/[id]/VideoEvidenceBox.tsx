"use client";

import { useState } from "react";

export function VideoEvidenceBox({ videoUrl }: { videoUrl: string }) {
  const [playing, setPlaying] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setPlaying((p) => !p)}
      className="relative flex w-full items-center justify-center overflow-hidden rounded-xl"
      style={{ aspectRatio: "5 / 6.2", background: "var(--panel-2)", border: "1px solid rgba(95,212,255,0.3)" }}
    >
      <svg width="30%" height="30%" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M16 2 L19 13 L30 16 L19 19 L16 30 L13 19 L2 16 L13 13 Z" fill="var(--cyan)" opacity={0.85} />
      </svg>
      {!playing ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ background: "rgba(10,12,16,0.35)" }}>
          <span className="flex items-center justify-center rounded-full" style={{ width: 44, height: 44, background: "rgba(95,212,255,0.14)", border: "1.5px solid rgba(95,212,255,0.4)", color: "var(--cyan)" }}>
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ marginLeft: 2 }}>
              <path d="M6 4l10 6-10 6V4z" fill="currentColor" />
            </svg>
          </span>
          <span className="mono rounded-full px-2 py-[3px] text-[11px]" style={{ color: "var(--white)", background: "rgba(10,12,16,0.6)" }}>
            00:48
          </span>
        </div>
      ) : (
        <span className="mono absolute inset-x-0 bottom-[10px] text-center text-[11px]" style={{ color: "var(--cyan)" }}>
          กำลังเล่น...
        </span>
      )}
    </button>
  );
}
