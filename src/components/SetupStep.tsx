import type { ReactNode } from "react";

export type StepState = "done" | "wait" | "todo" | "bad";

const NODE: Record<StepState, { bg: string; bd: string; fg: string; label: string }> = {
  done: { bg: "var(--cyan-tint)", bd: "var(--cyan-line)", fg: "var(--cyan)", label: "เสร็จแล้ว" },
  wait: { bg: "transparent", bd: "var(--line-strong)", fg: "var(--steel)", label: "รอตรวจ" },
  todo: { bg: "transparent", bd: "var(--line)", fg: "var(--steel)", label: "ยังไม่ทำ" },
  bad: { bg: "var(--danger-tint)", bd: "var(--danger-line)", fg: "var(--danger)", label: "ไม่ผ่าน" },
};

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Glyph({ state, n }: { state: StepState; n: number }) {
  if (state === "done") return <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.4 L8.4 13.6 L15 6.8" {...stroke} /></svg>;
  if (state === "wait") return <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" {...stroke} /><path d="M10 6.2 V10 L12.6 11.6" {...stroke} /></svg>;
  if (state === "bad") return <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 5 V11 M10 14.6 V14.7" {...stroke} /></svg>;
  return <span className="mono text-[12px] font-medium">{n}</span>;
}

/** One step on a vertical rail: a status node, a title with an optional action on the right, a note, and any inline body. */
export function SetupStep({
  state, n, title, note, action, last, children,
}: { state: StepState; n: number; title: string; note?: ReactNode; action?: ReactNode; last?: boolean; children?: ReactNode }) {
  const s = NODE[state];
  return (
    <li className={`relative grid grid-cols-[28px_1fr] gap-x-3.5 ${last ? "" : "pb-6"}`}>
      {!last && <span aria-hidden="true" className="absolute left-[13.5px] top-8 bottom-1 w-px" style={{ background: "var(--line)" }} />}
      <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: s.bg, border: `1px solid ${s.bd}`, color: s.fg }}>
        <Glyph state={state} n={n} />
        <span className="sr-only">{s.label}</span>
      </span>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[14.5px] font-medium leading-7" style={{ color: "var(--white)" }}>{title}</h3>
          {action}
        </div>
        {note && <div className="text-[12.5px] leading-relaxed" style={{ color: state === "bad" ? "var(--danger)" : "var(--steel)" }}>{note}</div>}
        {children}
      </div>
    </li>
  );
}
