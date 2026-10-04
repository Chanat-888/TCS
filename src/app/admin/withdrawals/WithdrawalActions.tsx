"use client";

import { useState } from "react";
import { finishWithdrawal } from "./actions";

export function WithdrawalActions({ id }: { id: string }) {
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function finish(paid: boolean) {
    if (!paid && !confirm("ยืนยันว่าโอนไม่สำเร็จ? เงินจะคืนเข้ายอดที่ผู้ขายถอนได้")) return;
    setBusy(true);
    setError("");
    const result = await finishWithdrawal(id, paid, reference);
    setBusy(false);
    if ("error" in result) setError(result.error ?? "");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        className="mono rounded-lg px-3 text-[13px]"
        style={{ height: 36, width: 180, background: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--white)" }}
        placeholder="เลขอ้างอิงธนาคาร"
        aria-label="เลขอ้างอิงธนาคาร"
        value={reference}
        onChange={(e) => setReference(e.target.value)}
      />
      <button type="button" disabled={busy} onClick={() => finish(true)} className="rounded-lg border-0 px-3 text-[13px] font-semibold cursor-pointer" style={{ height: 36, background: "var(--blue)", color: "var(--ink-on-blue)" }}>
        โอนแล้ว
      </button>
      <button type="button" disabled={busy} onClick={() => finish(false)} className="rounded-lg border-0 px-3 text-[13px] cursor-pointer" style={{ height: 36, background: "transparent", color: "var(--danger)" }}>
        ไม่สำเร็จ
      </button>
      {error && <span role="alert" className="text-[12.5px]" style={{ color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}
