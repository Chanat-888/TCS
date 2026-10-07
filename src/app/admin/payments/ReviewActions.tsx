"use client";

import { useState } from "react";
import { BANKS } from "@/lib/bankAccount";
import { decideSlip, finishRefund, fixPayer } from "./actions";

const input = { height: 36, width: 260, background: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--white)" };
const primary = { height: 36, background: "var(--blue)", color: "var(--ink-on-blue)" };
const quiet = { height: 36, background: "transparent", color: "var(--steel)" };

// Who paid, as the slip or the bank statement shows it. All optional: blank never blocks a decision, and the
// slip image stays the source of truth. The bank is a list so it cannot be mistyped.
function PayerFields({ value, onChange }: { value: { name: string; bank: string; hint: string }; onChange: (v: { name: string; bank: string; hint: string }) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className="rounded-lg px-3 text-[13px]" style={input} placeholder="ชื่อผู้โอน (ถ้าเห็น)" aria-label="ชื่อผู้โอน" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
      <select className="rounded-lg px-2 text-[13px]" style={{ ...input, width: 170 }} aria-label="ธนาคารผู้โอน" value={value.bank} onChange={(e) => onChange({ ...value, bank: e.target.value })}>
        <option value="">ธนาคารผู้โอน</option>
        {Object.entries(BANKS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
      </select>
      <input className="mono rounded-lg px-3 text-[13px]" style={{ ...input, width: 160 }} placeholder="เลขบัญชีที่เห็น" aria-label="เลขบัญชีที่เห็น" value={value.hint} onChange={(e) => onChange({ ...value, hint: e.target.value })} />
    </div>
  );
}

export function SlipReview({ slipId, slipBank }: { slipId: string; slipBank: string | null }) {
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [payer, setPayer] = useState({ name: "", bank: slipBank ?? "", hint: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(decision: "accept" | "reject" | "refund") {
    if (decision === "refund" && !confirm("ยืนยันว่าต้องคืนเงินให้ผู้ซื้อ? (ชำระซ้ำ ชำระหลังยกเลิก หรือยอดไม่ตรง)")) return;
    setBusy(true);
    setError("");
    const result = await decideSlip(slipId, decision, decision === "accept" ? reference : reason, payer);
    setBusy(false);
    if ("error" in result) setError(result.error ?? "");
  }

  return (
    <div className="flex flex-col gap-2">
      <PayerFields value={payer} onChange={setPayer} />
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

/** Corrects the payer fields on a decided slip. */
export function PayerEdit({ slipId, initial }: { slipId: string; initial: { name: string; bank: string; hint: string } }) {
  const [payer, setPayer] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    const result = await fixPayer(slipId, payer);
    setBusy(false);
    if ("error" in result) setError(result.error ?? "");
    else setSaved(true);
  }

  return (
    <div className="flex flex-col gap-2">
      <PayerFields value={payer} onChange={setPayer} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={save} className="rounded-lg border-0 px-3 text-[13px] font-semibold cursor-pointer" style={primary}>บันทึกข้อมูลผู้โอน</button>
        {saved && <span className="text-[12.5px]" style={{ color: "var(--good)" }}>บันทึกแล้ว</span>}
        {error && <span role="alert" className="text-[12.5px]" style={{ color: "var(--danger)" }}>{error}</span>}
      </div>
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
