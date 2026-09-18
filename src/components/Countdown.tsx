"use client";

import { useEffect, useState } from "react";

function format(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(Math.floor(s % 60)).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

/**
 * Ticks down from a server-computed starting point so SSR and hydration
 * render the same text (no mismatch warning) — only the client-side
 * interval updates it after mount.
 */
export function Countdown({
  endsAt,
  initialSeconds,
  onExpire,
  className,
}: {
  endsAt: string;
  initialSeconds: number;
  onExpire?: () => void;
  className?: string;
}) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    const target = new Date(endsAt).getTime();
    const tick = () => {
      const next = Math.max(0, Math.round((target - Date.now()) / 1000));
      setSeconds(next);
      if (next <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    };
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);

  return (
    <span className={`mono ${className ?? ""}`}>{format(seconds)}</span>
  );
}
