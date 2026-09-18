import type { ReactNode } from "react";

const CHECK = (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M4 10.5 L8 14.5 L16 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const HOLLOW = (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

export interface TimelineStep {
  label: string;
  meta: ReactNode;
  state: "done" | "active" | "pending";
  icon?: ReactNode;
}

export function OrderTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="relative">
      <div className="absolute bottom-[6px] left-[15px] top-[6px] w-[2px]" style={{ background: "rgba(140,147,163,0.16)" }} />
      {steps.map((step, i) => (
        <div key={i} className="relative pb-[26px] pl-12 last:pb-0">
          <div
            className="absolute left-0 top-0 flex items-center justify-center rounded-full"
            style={{
              width: 32,
              height: 32,
              background: step.state === "done" ? "rgba(79,201,122,0.08)" : step.state === "active" ? "rgba(95,212,255,0.08)" : "var(--panel)",
              border: `1.5px solid ${step.state === "done" ? "rgba(79,201,122,0.4)" : step.state === "active" ? "var(--cyan)" : "rgba(140,147,163,0.25)"}`,
              color: step.state === "done" ? "var(--good)" : step.state === "active" ? "var(--cyan)" : "var(--steel-dim)",
              boxShadow: step.state === "active" ? "0 0 0 4px rgba(95,212,255,0.08)" : undefined,
            }}
          >
            {step.state === "done" ? CHECK : step.icon ?? HOLLOW}
          </div>
          <h3 className="text-[14.5px] font-medium" style={{ color: step.state === "active" ? "var(--cyan)" : "var(--white)" }}>
            {step.label}
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
            {step.meta}
          </p>
        </div>
      ))}
    </div>
  );
}
