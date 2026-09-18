export function BrandMark({
  size = 30,
  variant = "full",
}: {
  size?: number;
  variant?: "full" | "compact";
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      {variant === "full" && (
        <rect
          x="4"
          y="7"
          width="22"
          height="30"
          rx="5"
          fill="var(--blue)"
          transform="rotate(-8 15 22)"
        />
      )}
      <rect
        x="10"
        y="5"
        width="22"
        height="30"
        rx="5"
        fill="#0D1016"
        stroke="rgba(95,212,255,0.5)"
        strokeWidth="1.5"
      />
      <path d="M21 15 L24.8 23.2 L21 31.4 L17.2 23.2 Z" fill="var(--cyan)" />
    </svg>
  );
}
