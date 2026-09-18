const TONES = {
  wait: { color: "var(--cyan)", bg: "rgba(95,212,255,0.1)", border: "rgba(95,212,255,0.28)", glow: true },
  done: { color: "var(--good)", bg: "rgba(79,201,122,0.1)", border: "rgba(79,201,122,0.3)", glow: false },
  danger: { color: "var(--danger)", bg: "rgba(232,102,79,0.1)", border: "rgba(232,102,79,0.3)", glow: false },
};

export function StatusPill({ tone, label }: { tone: keyof typeof TONES; label: string }) {
  const t = TONES[tone];
  return (
    <span
      className="mono inline-flex flex-shrink-0 items-center gap-[7px] rounded-full px-[14px] py-[7px] text-[12px]"
      style={{ color: t.color, background: t.bg, border: `1px solid ${t.border}` }}
    >
      <span
        className="rounded-full"
        style={{ width: 6, height: 6, background: t.color, boxShadow: t.glow ? `0 0 8px 1px ${t.color}` : undefined }}
      />
      {label}
    </span>
  );
}
