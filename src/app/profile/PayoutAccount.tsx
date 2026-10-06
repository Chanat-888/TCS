"use client";

import { useState, type CSSProperties } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SetupStep } from "@/components/SetupStep";
import { BANKS } from "@/lib/bankAccount";
import { saveBankAccount } from "./payoutActions";

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

const linkClass = "border-0 bg-transparent p-0 text-[13px] font-medium cursor-pointer leading-7";

/** Step 2 of the seller setup rail: the bank account payouts go to. */
export function PayoutAccount({ saved }: { saved: { bank_brand: string; account_last4: string; account_name: string } | null }) {
  const [editing, setEditing] = useState(!saved);
  const [form, setForm] = useState({ brand: "", number: "", name: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError("");
    const result = await saveBankAccount(form);
    setSaving(false);
    if ("error" in result) return setError(result.error ?? "");
    setForm({ brand: "", number: "", name: "" });
    setEditing(false);
  }

  const showSaved = saved && !editing;
  return (
    <SetupStep
      n={2}
      state={saved ? "done" : "todo"}
      title="บัญชีรับเงิน"
      action={showSaved ? <button type="button" className={linkClass} style={{ color: "var(--cyan)" }} onClick={() => setEditing(true)}>เปลี่ยน</button> : undefined}
      note={
        showSaved ? (
          <>
            <span style={{ color: "var(--white)" }}>{BANKS[saved.bank_brand] ?? saved.bank_brand} · <span className="mono">xxx{saved.account_last4}</span></span>
            <br />
            {saved.account_name}
          </>
        ) : (
          "ใช้ชื่อบัญชีที่ตรงกับสมุดบัญชีเท่านั้น"
        )
      }
    >
      {!showSaved && (
        <div className="mt-3 flex flex-col gap-3">
          <select style={inputStyle} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} aria-label="ธนาคาร">
            <option value="">เลือกธนาคาร</option>
            {Object.entries(BANKS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
          <input style={inputStyle} className="mono" inputMode="numeric" placeholder="เลขบัญชี" aria-label="เลขบัญชี" autoComplete="off" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
          <input style={inputStyle} placeholder="ชื่อบัญชี" aria-label="ชื่อบัญชี" autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          {error && <p role="alert" className="text-[12.5px]" style={{ color: "var(--danger)" }}>{error}</p>}
          <div className="flex items-center gap-3">
            <PrimaryButton loading={saving} onClick={submit}>บันทึกบัญชี</PrimaryButton>
            {saved && <button type="button" className={linkClass} style={{ color: "var(--steel)" }} onClick={() => setEditing(false)}>ยกเลิก</button>}
          </div>
        </div>
      )}
    </SetupStep>
  );
}
