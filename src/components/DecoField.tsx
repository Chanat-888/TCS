"use client";

import { useEffect, useState } from "react";

const CREST_PATHS = {
  burst: "M16 2 L19 10 L27 8 L22 15 L28 20 L20 21 L21 29 L16 23 L11 29 L12 21 L4 20 L10 15 L5 8 L13 10 Z",
  star: "M16 3 L20 13 L31 13 L22 20 L25 30 L16 24 L7 30 L10 20 L1 13 L12 13 Z",
  spark: "M16 2 L19 13 L30 16 L19 19 L16 30 L13 19 L2 16 L13 13 Z",
};
const CREST_KEYS = Object.keys(CREST_PATHS) as (keyof typeof CREST_PATHS)[];

interface DecoCardSpec {
  key: keyof typeof CREST_PATHS;
  top: number;
  left: number;
  rotate: number;
  opacity: number;
}

/** Scattered low-opacity decorative cards, per DESIGN.md's "Decorative background cards" motif. */
export function DecoField({
  count = 5,
  cardWidth = 74,
  cardHeight = 104,
  edgesOnly = false,
  opacityRange = [0.5, 0.5],
}: {
  count?: number;
  cardWidth?: number;
  cardHeight?: number;
  /** Login-style layout: cards hug the left/right edges instead of scattering freely. */
  edgesOnly?: boolean;
  opacityRange?: [number, number];
}) {
  // Positions are randomized client-side only (after mount) to avoid a
  // server/client hydration mismatch — matches the original mockups, which
  // also scatter these via a script that runs after the page loads.
  const [cards, setCards] = useState<DecoCardSpec[]>([]);

  useEffect(() => {
    const [min, max] = opacityRange;
    // Client-only randomization, intentionally set after mount (see comment above).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCards(
      Array.from({ length: count }, (_, i) => {
        const left = edgesOnly
          ? i % 2 === 0
            ? Math.random() * 10
            : 88 + Math.random() * 10
          : Math.random() * 90 + 2;
        return {
          key: CREST_KEYS[i % CREST_KEYS.length],
          top: Math.random() * 82 + 4,
          left,
          rotate: Math.random() * 22 - 11,
          opacity: min + Math.random() * (max - min),
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, edgesOnly]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      {cards.map((card, i) => (
        <div
          key={i}
          className="absolute rounded-xl flex items-center justify-center"
          style={{
            width: cardWidth,
            height: cardHeight,
            background: "var(--panel)",
            border: "1px solid rgba(95, 212, 255, 0.14)",
            top: `${card.top}%`,
            left: `${card.left}%`,
            transform: `rotate(${card.rotate.toFixed(1)}deg)`,
            opacity: card.opacity,
          }}
        >
          <svg width={cardWidth * 0.4} height={cardWidth * 0.4} viewBox="0 0 32 32" aria-hidden="true">
            <path d={CREST_PATHS[card.key]} fill="var(--cyan)" opacity={0.85} />
          </svg>
        </div>
      ))}
    </div>
  );
}
