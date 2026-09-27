"use client";

import { useState, useTransition } from "react";
import { toggleWatch } from "@/app/listings/[id]/watchActions";

/** Star a listing to get notified when it's ending soon or has closed. */
export function WatchButton({ listingId, initialWatching }: { listingId: string; initialWatching: boolean }) {
  const [watching, setWatching] = useState(initialWatching);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !watching;
    setWatching(next); // optimistic; reverted below if the server disagrees
    startTransition(async () => {
      const result = await toggleWatch(listingId);
      if ("error" in result) setWatching(!next);
      else setWatching(result.watching);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={watching}
      aria-label={watching ? "เลิกติดตามประกาศนี้" : "ติดตามประกาศนี้"}
      className="flex min-h-11 items-center gap-[6px] rounded-full px-[14px] text-[13px] font-medium transition-colors disabled:opacity-60"
      style={
        watching
          ? { background: "var(--cyan-tint)", border: "1px solid var(--cyan-line)", color: "var(--cyan)" }
          : { background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--steel)" }
      }
    >
      <svg width="15" height="15" viewBox="0 0 20 20" fill={watching ? "currentColor" : "none"} aria-hidden="true">
        <path
          d="M10 2 L12.2 7.4 L18 8 L13.6 11.8 L15 17.5 L10 14.2 L5 17.5 L6.4 11.8 L2 8 L7.8 7.4 Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
      {watching ? "กำลังติดตาม" : "ติดตามประกาศ"}
    </button>
  );
}
