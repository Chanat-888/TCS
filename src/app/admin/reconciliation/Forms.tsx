"use client";

import { useState } from "react";
import { logReconciliation, matchOrderPayment } from "./actions";

const input = { height: 36, width: 180, background: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--white)" };
const button = { height: 36, background: "var(--blue)", color: "var(--ink-on-blue)" };

function useSubmit(run: (value: string) => Promise<{ error?: string }>) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setError("");
    const result = await run(value);
    setBusy(false);
    if (result.error) setError(result.error);
    else setValue("");
  }
  return { value, setValue, error, busy, submit };
}

export function BalanceForm() {
  const f = useSubmit((v) => logReconciliation(Number(v)));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className="mono rounded-lg px-3 text-[13px]" style={input} inputMode="decimal" placeholder="ยอดบัญชี B (บาท)" aria-label="ยอดบัญชี B (บาท)" value={f.value} onChange={(e) => f.setValue(e.target.value)} />
      <button type="button" disabled={f.busy || !f.value} onClick={f.submit} className="rounded-lg border-0 px-3 text-[13px] font-semibold cursor-pointer" style={button}>บันทึกการตรวจ</button>
      {f.error && <span role="alert" className="text-[12.5px]" style={{ color: "var(--danger)" }}>{f.error}</span>}
    </div>
  );
}

export function MatchForm({ orderId }: { orderId: string }) {
  const f = useSubmit((v) => matchOrderPayment(orderId, v));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className="mono rounded-lg px-3 text-[13px]" style={input} placeholder="เลขอ้างอิงใน statement" aria-label="เลขอ้างอิงใน statement" value={f.value} onChange={(e) => f.setValue(e.target.value)} />
      <button type="button" disabled={f.busy} onClick={f.submit} className="rounded-lg border-0 px-3 text-[13px] font-semibold cursor-pointer" style={button}>จับคู่แล้ว</button>
      {f.error && <span role="alert" className="text-[12.5px]" style={{ color: "var(--danger)" }}>{f.error}</span>}
    </div>
  );
}
