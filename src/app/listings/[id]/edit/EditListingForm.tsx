"use client";

import { useState, type CSSProperties } from "react";
import { formatTHB } from "@/lib/format";
import type { Listing } from "@/lib/supabase/types";

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

function SpecRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 py-[10px] first:pt-0" style={{ borderTop: "1px solid rgba(140,147,163,0.1)" }}>
      <span className="text-[12.5px]" style={{ color: "var(--steel)" }}>
        {k}
      </span>
      <span className="text-right text-[13.5px] font-medium" style={{ color: "var(--white)" }}>
        {v}
      </span>
    </div>
  );
}

function LockBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-[7px] py-[2px] text-[10px]" style={{ color: "var(--steel-dim)", background: "rgba(140,147,163,0.1)", border: "1px solid rgba(140,147,163,0.2)" }}>
      <svg width="9" height="9" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="4.5" y="9" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      ล็อกแล้ว
    </span>
  );
}

export function EditListingForm({ listing, bidCount, locked }: { listing: Listing; bidCount: number; locked: boolean }) {
  const [description, setDescription] = useState(listing.description);
  const [name, setName] = useState(listing.name);
  const [setName2, setSetName] = useState(listing.set_name);
  const [category, setCategory] = useState(listing.category);
  const [condition, setCondition] = useState(listing.condition);
  const [startPrice, setStartPrice] = useState(String(listing.start_price));
  const [buyNowPrice, setBuyNowPrice] = useState(listing.buy_now_price ? String(listing.buy_now_price) : "");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [edited, setEdited] = useState(Boolean(listing.description_edited_at));
  const [editedAt, setEditedAt] = useState(listing.description_edited_at);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    const formData = new FormData();
    formData.append("description", description);
    if (!locked) {
      formData.append("name", name);
      formData.append("set", setName2);
      formData.append("category", category);
      formData.append("condition", condition);
      formData.append("startPrice", startPrice);
      if (buyNowPrice) formData.append("buyNowPrice", buyNowPrice);
    }
    const res = await fetch(`/api/listings/${listing.id}`, { method: "PATCH", body: formData });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "บันทึกไม่สำเร็จ");
      return;
    }
    setSaved(true);
    if (json.changed) {
      setEdited(true);
      setEditedAt(json.editedAt);
    }
  }

  return (
    <>
      <div className="flex items-start gap-[10px] rounded-xl px-4 py-[14px]" style={{ background: "rgba(95,212,255,0.06)", border: "1px solid rgba(95,212,255,0.2)" }}>
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: "var(--cyan)", flexShrink: 0, marginTop: 1 }}>
          <rect x="4.5" y="9" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--steel)" }}>
          {locked ? (
            <>
              <strong style={{ color: "var(--white)", fontWeight: 500 }}>ประกาศนี้มีผู้บิดแล้ว</strong> รายละเอียดส่วนใหญ่จึงถูกล็อกไว้เพื่อความเป็นธรรมกับผู้บิดทุกคน
              แก้ไขได้เฉพาะ &ldquo;รายละเอียดเพิ่มเติม&rdquo; ด้านล่าง
            </>
          ) : (
            <>
              <strong style={{ color: "var(--white)", fontWeight: 500 }}>ยังไม่มีผู้บิดประกาศนี้</strong> คุณแก้ไขได้ทุกช่อง รวมถึงรูปภาพ
            </>
          )}
        </p>
      </div>

      {locked && (
        <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl" style={{ background: "rgba(140,147,163,0.12)", border: "1px solid rgba(140,147,163,0.12)" }}>
          <div className="p-[13px]" style={{ background: "var(--panel)" }}>
            <p className="mono text-[16px]" style={{ color: "var(--cyan)" }}>{formatTHB(listing.current_price)}</p>
            <p className="mt-[3px] text-[10.5px]" style={{ color: "var(--steel)" }}>ราคาปัจจุบัน</p>
          </div>
          <div className="p-[13px]" style={{ background: "var(--panel)" }}>
            <p className="mono text-[16px]" style={{ color: "var(--white)" }}>{bidCount}</p>
            <p className="mt-[3px] text-[10.5px]" style={{ color: "var(--steel)" }}>จำนวนผู้บิด</p>
          </div>
          <div className="p-[13px]" style={{ background: "var(--panel)" }}>
            <p className="mono text-[16px]" style={{ color: "var(--white)" }}>{listing.status === "active" ? "เปิดอยู่" : listing.status}</p>
            <p className="mt-[3px] text-[10.5px]" style={{ color: "var(--steel)" }}>สถานะ</p>
          </div>
        </div>
      )}

      <h2 className="mb-3 mt-6 text-[14px] font-medium" style={{ color: "var(--steel)" }}>
        รายละเอียดการ์ด
      </h2>
      <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
        {locked ? (
          <div>
            <SpecRow k="ชื่อการ์ด" v={listing.name} />
            <SpecRow k="ชุด" v={listing.set_name} />
            <SpecRow k="หมวดหมู่" v={listing.category} />
            <SpecRow k="สภาพการ์ด" v={listing.condition} />
          </div>
        ) : (
          <>
            <div>
              <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>ชื่อการ์ด</label>
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="mt-[14px] grid grid-cols-2 gap-3">
              <div>
                <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>ชุด</label>
                <input style={inputStyle} value={setName2} onChange={(e) => setSetName(e.target.value)} />
              </div>
              <div>
                <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>หมวดหมู่</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as Listing["category"])} style={{ ...inputStyle, color: "var(--white)" }}>
                  <option value="new">บูสเตอร์ใหม่</option>
                  <option value="deck">เด็คพร้อมเล่น</option>
                  <option value="rare">การ์ดหายาก</option>
                </select>
              </div>
            </div>
            <div className="mt-[14px]">
              <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>สภาพการ์ด</label>
              <input style={inputStyle} value={condition} onChange={(e) => setCondition(e.target.value)} />
            </div>
            <div className="mt-[14px] grid grid-cols-2 gap-3">
              <div>
                <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>ราคาเริ่มต้น</label>
                <input className="mono" style={inputStyle} value={startPrice} onChange={(e) => setStartPrice(e.target.value.replace(/\D/g, ""))} />
              </div>
              <div>
                <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>ราคาซื้อทันที (ไม่บังคับ)</label>
                <input className="mono" style={inputStyle} value={buyNowPrice} onChange={(e) => setBuyNowPrice(e.target.value.replace(/\D/g, ""))} />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mb-3 mt-6 flex flex-wrap items-center gap-[10px]">
        <h2 className="text-[14px] font-medium" style={{ color: "var(--steel)" }}>
          รายละเอียดเพิ่มเติม
        </h2>
        {edited && (
          <span className="mono inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] text-[10.5px]" style={{ color: "var(--cyan)", background: "rgba(95,212,255,0.08)", border: "1px solid rgba(95,212,255,0.22)" }}>
            <svg width="10" height="10" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M13.5 3.5 L16.5 6.5 L7 16 L3.5 16.5 L4 13 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
            แก้ไขแล้ว · {editedAt ? new Date(editedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" }) : ""}
          </span>
        )}
        {locked && <LockBadge />}
      </div>
      <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
        <textarea
          maxLength={400}
          value={description}
          onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
          className="w-full resize-y rounded-[10px] p-3 text-[14px] leading-relaxed outline-none"
          style={{ background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--white)", minHeight: 100 }}
        />
        <p className="mono mt-[6px] text-right text-[11px]" style={{ color: "var(--steel-dim)" }}>
          {description.length} / 400
        </p>
        {error && (
          <p className="mt-2 text-[12.5px]" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-[18px] h-[50px] w-full rounded-[11px] text-[14.5px] font-semibold"
          style={{ background: "var(--blue)", color: "#071523" }}
        >
          {saving ? "..." : "บันทึกการเปลี่ยนแปลง"}
        </button>
        {saved && (
          <p className="mt-3 flex items-center gap-[7px] text-[12.5px]" style={{ color: "var(--good)" }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M4 10.5 L8 14.5 L16 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            บันทึกแล้ว{locked ? " — ผู้บิดจะเห็นป้าย \"แก้ไขแล้ว\" บนประกาศนี้" : ""}
          </p>
        )}
      </div>
    </>
  );
}
