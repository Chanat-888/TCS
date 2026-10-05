"use client";

import { useState, type CSSProperties } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { MIN_WITHDRAWAL_BAHT, formatSatang, withdrawalFeeSatang } from "@/lib/money";
import { requestWithdrawal } from "./actions";

const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--panel-2)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  height: 44,
  padding: "0 13px",
  color: "var(--white)",
  fontSize: 14.5,
  outline: "none",
};

export function WithdrawForm({ availableBaht }: { availableBaht: number }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const baht = Number(amount);
  const valid = Number.isInteger(baht) && baht >= MIN_WITHDRAWAL_BAHT && baht <= availableBaht;
  const fee = valid ? withdrawalFeeSatang(baht * 100) : 0;

  async function submit() {
    setSending(true);
    setError("");
    setDone(false);
    const result = await requestWithdrawal(baht);
    setSending(false);
    if ("error" in result) return setError(result.error ?? "");
    setAmount("");
    setDone(true);
  }

  return (
    <div className="mt-4 flex max-w-sm flex-col gap-3">
      <input style={inputStyle} className="mono" inputMode="numeric" placeholder={`จำนวนเงิน (บาท, ขั้นต่ำ ${MIN_WITHDRAWAL_BAHT})`} aria-label="จำนวนเงินที่ถอน" value={amount} onChange={(e) => setAmount(e.target.value)} />
      {valid && (
        <p className="text-[12.5px]" style={{ color: "var(--steel)" }}>
          ค่าถอน 1% {formatSatang(fee)} · คุณจะได้รับ {formatSatang(baht * 100 - fee)}
        </p>
      )}
      {error && <p role="alert" className="text-[12.5px]" style={{ color: "var(--danger)" }}>{error}</p>}
      {done && <p className="text-[12.5px]" style={{ color: "var(--good)" }}>ส่งคำขอถอนแล้ว เราจะโอนให้ภายในรอบถัดไป</p>}
      <PrimaryButton loading={sending} disabled={!valid} onClick={submit}>ขอถอนเงิน</PrimaryButton>
    </div>
  );
}
