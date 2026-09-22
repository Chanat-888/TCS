"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ProvinceCombobox } from "@/components/ProvinceCombobox";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { MAX_ADDRESSES, type SavedAddress } from "@/lib/addresses";
import { deleteAddress, saveAddress, setDefaultAddress } from "./addressActions";

const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--panel-2)",
  border: "1px solid rgba(140,147,163,0.2)",
  borderRadius: 10,
  height: 44,
  padding: "0 13px",
  color: "var(--white)",
  fontSize: 14.5,
  outline: "none",
};

const EMPTY = { label: "", recipient: "", phone: "", address: "", province: "", postcode: "" };
const LABEL_SUGGESTIONS = ["บ้าน", "ที่ทำงาน", "คอนโด"];

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="mt-[14px] first:mt-0">
      <label htmlFor={htmlFor} className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function AddressManager({ addresses }: { addresses: SavedAddress[] }) {
  const [editing, setEditing] = useState<SavedAddress | "new" | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [listError, setListError] = useState("");
  const firstField = useRef<HTMLInputElement>(null);

  const atLimit = addresses.length >= MAX_ADDRESSES;

  function open(target: SavedAddress | "new") {
    setForm(target === "new" ? { ...EMPTY, label: addresses.length === 0 ? "บ้าน" : "" } : {
      label: target.label, recipient: target.recipient, phone: target.phone,
      address: target.address, province: target.province, postcode: target.postcode,
    });
    setError("");
    setEditing(target);
  }

  useEffect(() => {
    if (!editing) return;
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && setEditing(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, busy]);

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
  }

  async function save() {
    if (busy || !editing) return;
    setBusy(true);
    setError("");
    try {
      const result = await saveAddress(form, editing === "new" ? undefined : editing.id);
      if ("error" in result) setError(result.error ?? "บันทึกไม่สำเร็จ");
      else setEditing(null);
    } catch {
      setError("เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function run(action: () => Promise<{ error?: string } | { success: true }>) {
    if (busy) return;
    setBusy(true);
    setListError("");
    try {
      const result = await action();
      if ("error" in result && result.error) setListError(result.error);
    } catch {
      setListError("เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(false);
      setConfirmId(null);
    }
  }

  return (
    <section className="wrap py-6">
      <div className="max-w-2xl rounded-2xl p-5" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.2)" }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg">ที่อยู่จัดส่ง</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
              บันทึกไว้ครั้งเดียว ใช้ตอนชำระเงินได้ทันที ผู้ขายจะเห็นที่อยู่เฉพาะคำสั่งซื้อของคุณเท่านั้น
            </p>
          </div>
          <button
            type="button"
            onClick={() => open("new")}
            disabled={atLimit}
            className="cursor-pointer rounded-[10px] px-4 py-[9px] text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--panel-2)", border: "1px solid rgba(95,212,255,0.3)", color: "var(--white)" }}
          >
            + เพิ่มที่อยู่
          </button>
        </div>

        {atLimit && (
          <p className="mt-3 text-[12px]" style={{ color: "var(--steel-dim)" }}>
            บันทึกครบ {MAX_ADDRESSES} ที่อยู่แล้ว ลบอันเก่าก่อนเพิ่มใหม่
          </p>
        )}
        {listError && <p role="alert" className="mt-3 text-[12.5px]" style={{ color: "var(--danger)" }}>{listError}</p>}

        {addresses.length === 0 ? (
          <p className="mt-4 text-[13.5px]" style={{ color: "var(--steel)" }}>
            ยังไม่มีที่อยู่ที่บันทึกไว้ เพิ่มที่อยู่เพื่อไม่ต้องกรอกใหม่ทุกครั้งที่ซื้อ
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {addresses.map((a) => (
              <li key={a.id} className="rounded-xl p-4" style={{ background: "var(--panel-2)", border: `1px solid ${a.is_default ? "rgba(95,212,255,0.35)" : "rgba(140,147,163,0.14)"}` }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-medium" style={{ color: "var(--white)" }}>{a.label}</span>
                  {a.is_default && (
                    <span className="rounded-full px-2 py-[2px] text-[10.5px]" style={{ background: "rgba(95,212,255,0.1)", border: "1px solid rgba(95,212,255,0.3)", color: "var(--cyan)" }}>
                      ค่าเริ่มต้น
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
                  {a.recipient} · <span className="mono">{a.phone}</span>
                  <br />
                  {a.address} {a.province} <span className="mono">{a.postcode}</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[12.5px]">
                  {!a.is_default && (
                    <button type="button" disabled={busy} className="cursor-pointer" style={{ color: "var(--cyan)" }} onClick={() => run(() => setDefaultAddress(a.id))}>
                      ตั้งเป็นค่าเริ่มต้น
                    </button>
                  )}
                  <button type="button" disabled={busy} className="cursor-pointer" style={{ color: "var(--steel)" }} onClick={() => open(a)}>
                    แก้ไข
                  </button>
                  {confirmId === a.id ? (
                    <>
                      <button type="button" disabled={busy} className="cursor-pointer font-medium" style={{ color: "var(--danger)" }} onClick={() => run(() => deleteAddress(a.id))}>
                        ยืนยันลบ
                      </button>
                      <button type="button" disabled={busy} className="cursor-pointer" style={{ color: "var(--steel)" }} onClick={() => setConfirmId(null)}>
                        ยกเลิก
                      </button>
                    </>
                  ) : (
                    <button type="button" disabled={busy} className="cursor-pointer" style={{ color: "var(--steel)" }} onClick={() => setConfirmId(a.id)}>
                      ลบ
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto px-5 py-8"
          style={{ background: "rgba(5, 7, 10, 0.72)" }}
          onMouseDown={(e) => e.target === e.currentTarget && !busy && setEditing(null)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="address-dialog-title"
            className="w-full rounded-[18px] text-left"
            style={{ maxWidth: 460, background: "var(--panel)", border: "1px solid rgba(140,147,163,0.18)", padding: "26px 22px" }}
            onSubmit={(e) => { e.preventDefault(); save(); }}
          >
            <h2 id="address-dialog-title" className="text-[1.2rem]">{editing === "new" ? "เพิ่มที่อยู่จัดส่ง" : "แก้ไขที่อยู่"}</h2>
            {error && <p role="alert" className="mt-3 text-[13px]" style={{ color: "var(--danger)" }}>{error}</p>}

            <div className="mt-4">
              <Field label="ชื่อที่อยู่" htmlFor="addr-label">
                <input id="addr-label" ref={firstField} style={inputStyle} value={form.label} maxLength={20} disabled={busy} onChange={(e) => set("label", e.target.value)} placeholder="เช่น บ้าน" />
                <div className="mt-2 flex flex-wrap gap-2">
                  {LABEL_SUGGESTIONS.map((s) => (
                    <button key={s} type="button" disabled={busy} className="cursor-pointer rounded-full px-3 py-1 text-[12px]" style={{ background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--steel)" }} onClick={() => set("label", s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="ชื่อผู้รับ" htmlFor="addr-recipient">
                <input id="addr-recipient" style={inputStyle} value={form.recipient} maxLength={60} disabled={busy} onChange={(e) => set("recipient", e.target.value)} placeholder="ชื่อ-นามสกุล" autoComplete="name" />
              </Field>
              <Field label="เบอร์โทรศัพท์" htmlFor="addr-phone">
                <input id="addr-phone" className="mono" style={inputStyle} value={form.phone} maxLength={16} disabled={busy} onChange={(e) => set("phone", e.target.value)} placeholder="08X-XXX-XXXX" inputMode="tel" autoComplete="tel" />
              </Field>
              <Field label="ที่อยู่" htmlFor="addr-address">
                <textarea id="addr-address" style={{ ...inputStyle, height: "auto", minHeight: 72, padding: "11px 13px", resize: "vertical" }} value={form.address} maxLength={300} disabled={busy} onChange={(e) => set("address", e.target.value)} placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ" />
              </Field>
              <div className="mt-[14px] grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
                <Field label="จังหวัด">
                  <ProvinceCombobox value={form.province} onChange={(v) => set("province", v)} inputStyle={inputStyle} placeholder="กรุงเทพมหานคร" />
                </Field>
                <Field label="รหัสไปรษณีย์" htmlFor="addr-postcode">
                  <input id="addr-postcode" className="mono" style={inputStyle} value={form.postcode} maxLength={5} disabled={busy} onChange={(e) => set("postcode", e.target.value.replace(/\D/g, ""))} placeholder="10XXX" inputMode="numeric" autoComplete="postal-code" />
                </Field>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setEditing(null)} disabled={busy} className="h-[46px] flex-1 cursor-pointer rounded-[11px] text-[14px] disabled:opacity-40" style={{ background: "transparent", border: "1px solid rgba(140,147,163,0.3)", color: "var(--steel)" }}>
                ยกเลิก
              </button>
              <div className="flex-1">
                <PrimaryButton type="submit" height={46} loading={busy}>บันทึก</PrimaryButton>
              </div>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
