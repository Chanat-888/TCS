"use client";

import { useState, type CSSProperties } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
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

  return (
    <section className="wrap py-6">
      <div className="max-w-md rounded-2xl p-5" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
        <h2 className="text-[1.15rem]">บัญชีรับเงินของผู้ขาย</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
          เมื่อผู้ซื้อรับสินค้าแล้ว เราจะโอนเงินเข้าบัญชีนี้ (หักค่าธรรมเนียม 5%) ใช้ชื่อบัญชีที่ตรงกับสมุดบัญชีเท่านั้น
        </p>
        {saved && !editing ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[14px]" style={{ color: "var(--white)" }}>
              {BANKS[saved.bank_brand] ?? saved.bank_brand} · <span className="mono">xxx{saved.account_last4}</span>
              <span className="block text-[12.5px]" style={{ color: "var(--steel)" }}>{saved.account_name}</span>
            </p>
            <button type="button" className="border-0 bg-transparent p-0 text-[13px] font-medium cursor-pointer" style={{ color: "var(--cyan)" }} onClick={() => setEditing(true)}>
              เปลี่ยนบัญชี
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <select style={inputStyle} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} aria-label="ธนาคาร">
              <option value="">เลือกธนาคาร</option>
              {Object.entries(BANKS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
            <input style={inputStyle} className="mono" inputMode="numeric" placeholder="เลขบัญชี" aria-label="เลขบัญชี" autoComplete="off" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
            <input style={inputStyle} placeholder="ชื่อบัญชี" aria-label="ชื่อบัญชี" autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {error && <p role="alert" className="text-[12.5px]" style={{ color: "var(--danger)" }}>{error}</p>}
            <PrimaryButton loading={saving} onClick={submit}>บันทึกบัญชี</PrimaryButton>
          </div>
        )}
      </div>
    </section>
  );
}
