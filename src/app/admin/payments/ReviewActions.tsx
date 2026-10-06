"use client";

import { useState } from "react";
import { decideSlip, finishRefund } from "./actions";

const input = { height: 36, width: 260, background: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--white)" };
const primary = { height: 36, background: "var(--blue)", color: "var(--ink-on-blue)" };
const quiet = { height: 36, background: "transparent", color: "var(--steel)" };

export function SlipReview({ slipId }: { slipId: string }) {
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(decision: "accept" | "reject" | "refund") {
    if (decision === "refund" && !confirm("ยืนยันว่าต้องคืนเงินให้ผู้ซื้อ? (ชำระซ้ำ ชำระหลังยกเลิก หรือยอดไม่ตรง)")) return;
    setBusy(true);
    setError("");
    const result = await decideSlip(slipId, decision, decision === "accept" ? reference : reason);
    setBusy(false);
    if ("error" in result) setError(result.error ?? "");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input className="mono rounded-lg px-3 text-[13px]" style={input} placeholder="เลขอ้างอิงใน statement (เมื่อยืนยัน)" aria-label="เลขอ้างอิงใน statement" value={reference} onChange={(e) => setReference(e.target.value)} />
        <button type="button" disabled={busy} onClick={() => decide("accept")} className="rounded-lg border-0 px-3 text-[13px] font-semibold cursor-pointer" style={primary}>ยืนยันรับเงิน</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input className="rounded-lg px-3 text-[13px]" style={input} placeholder="เหตุผล (เมื่อปฏิเสธหรือคืนเงิน)" aria-label="เหตุผล" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button type="button" disabled={busy} onClick={() => decide("reject")} className="rounded-lg border-0 px-3 text-[13px] cursor-pointer" style={{ ...quiet, color: "var(--danger)" }}>ปฏิเสธสลิป</button>
        <button type="button" disabled={busy} onClick={() => decide("refund")} className="rounded-lg border-0 px-3 text-[13px] cursor-pointer" style={quiet}>ต้องคืนเงิน</button>
      </div>
      {error && <span role="alert" className="text-[12.5px]" style={{ color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}

export function RefundDone({ slipId }: { slipId: string }) {
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function finish() {
    setBusy(true);
    setError("");
    const result = await finishRefund(slipId, reference);
    setBusy(false);
    if ("error" in result) setError(result.error ?? "");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className="mono rounded-lg px-3 text-[13px]" style={input} placeholder="เลขอ้างอิงการโอนคืน" aria-label="เลขอ้างอิงการโอนคืน" value={reference} onChange={(e) => setReference(e.target.value)} />
      <button type="button" disabled={busy} onClick={finish} className="rounded-lg border-0 px-3 text-[13px] font-semibold cursor-pointer" style={primary}>โอนคืนแล้ว</button>
      {error && <span role="alert" className="text-[12.5px]" style={{ color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}
