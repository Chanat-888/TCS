const STAR_PATH = "M10 1.5l2.6 5.5 6 .7-4.4 4.1 1.2 6-5.4-3-5.4 3 1.2-6L1.4 7.7l6-.7z";

/** Display-only star row (small). Distinct from the tappable star-picker input. */
export function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-px align-[-2px]" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 20 20" style={{ color: n <= value ? "var(--gold)" : "var(--steel-dim)" }}>
          <path fill="currentColor" d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}
