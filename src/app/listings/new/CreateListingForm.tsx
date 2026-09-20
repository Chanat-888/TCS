"use client";

import { useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { formatTHB } from "@/lib/format";

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

function PhotoSlot({
  label,
  file,
  onPick,
  onRemove,
}: {
  label: string;
  file: File | null;
  onPick: (f: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = file ? URL.createObjectURL(file) : null;

  return (
    <div>
      <p className="mb-2 text-[12.5px]" style={{ color: "var(--steel)" }}>
        {label} <span style={{ color: "var(--danger)" }}>*</span>
      </p>
      <div className="relative" style={{ aspectRatio: "5 / 6.2" }}>
        {!preview ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-[13px]"
            style={{ border: "1.5px dashed rgba(140,147,163,0.28)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ color: "var(--steel)" }}>
              <path d="M12 16V4M12 4l-4 4M12 4l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <p className="px-[10px] text-center text-[12px]" style={{ color: "var(--steel)" }}>
              แตะเพื่ออัปโหลดรูป{label}
            </p>
          </button>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-[13px]" style={{ background: "var(--panel-2)", border: "1.5px solid rgba(95,212,255,0.35)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={label} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={onRemove}
              aria-label={`ลบรูป${label}`}
              className="absolute right-2 top-2 flex items-center justify-center rounded-lg"
              style={{ width: 26, height: 26, background: "rgba(10,12,16,0.75)", backdropFilter: "blur(6px)", border: "1px solid rgba(140,147,163,0.25)", color: "var(--steel)" }}
            >
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
        />
      </div>
    </div>
  );
}

export function CreateListingForm() {
  const [mode, setMode] = useState<"auction" | "sell">("auction");
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [set, setSet] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [description, setDescription] = useState("");
  const [startPrice, setStartPrice] = useState("");
  const [duration, setDuration] = useState("3");
  const [sellPrice, setSellPrice] = useState("");

  const [photoError, setPhotoError] = useState(false);
  const [detailsError, setDetailsError] = useState(false);
  const [priceError, setPriceError] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string; name: string; startPrice: number; rarity: string } | null>(null);

  async function handlePublish() {
    if (!front || !back) {
      setPhotoError(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setPhotoError(false);
    if (!name.trim() || !set.trim() || !category || !condition) {
      setDetailsError(true);
      return;
    }
    setDetailsError(false);
    const price = mode === "sell" ? sellPrice : startPrice;
    if (!price.trim()) {
      setPriceError(true);
      return;
    }
    setPriceError(false);

    setSubmitting(true);
    setSubmitError("");
    const formData = new FormData();
    formData.append("front", front);
    formData.append("back", back);
    formData.append("name", name.trim());
    formData.append("set", set.trim());
    formData.append("category", category);
    formData.append("condition", condition);
    formData.append("description", description.trim());
    if (mode === "sell") {
      formData.append("startPrice", sellPrice);
      formData.append("buyNowPrice", sellPrice);
    } else {
      formData.append("startPrice", startPrice);
      formData.append("duration", duration);
    }

    const res = await fetch("/api/listings", { method: "POST", body: formData });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setSubmitError(json.error ?? "เผยแพร่ประกาศไม่สำเร็จ");
      return;
    }
    setResult(json);
    window.scrollTo({ top: 0 });
  }

  if (result) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto mb-4 flex items-center justify-center rounded-full" style={{ width: 56, height: 56, background: "rgba(79,201,122,0.12)", border: "1px solid rgba(79,201,122,0.35)", color: "var(--good)" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5 L9.5 17 L19 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-[1.4rem]">ประกาศของคุณเผยแพร่แล้ว</h1>
        <p className="mx-auto mt-2 max-w-[42ch] text-[14.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
          ผู้ซื้อเห็นประกาศนี้ในหน้าหลักได้ทันที รูปภาพจะถูกล็อกโดยอัตโนมัติทันทีที่มีการบิดครั้งแรก
        </p>

        <div className="mx-auto mt-6 max-w-[220px] overflow-hidden rounded-2xl text-left" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
          <div className="relative flex items-center justify-center" style={{ aspectRatio: "5 / 6", background: "var(--panel-2)" }}>
            <span className="mono absolute left-[9px] top-[9px] rounded-full px-2 py-[3px] text-[10.5px]" style={{ color: "var(--cyan)", background: "rgba(95,212,255,0.1)", border: "1px solid rgba(95,212,255,0.28)" }}>
              ราคาเริ่มต้น
            </span>
            <svg width="34%" height="34%" viewBox="0 0 32 32" aria-hidden="true">
              <path d="M16 2 L19 10 L27 8 L22 15 L28 20 L20 21 L21 29 L16 23 L11 29 L12 21 L4 20 L10 15 L5 8 L13 10 Z" fill="var(--blue)" opacity={0.85} />
            </svg>
          </div>
          <div className="p-[14px]">
            <p className="text-[13.5px] font-medium leading-snug" style={{ color: "var(--white)" }}>
              {result.name}
            </p>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="mono text-[15px]" style={{ color: "var(--white)" }}>
                {formatTHB(result.startPrice)}
              </span>
              <span className="text-[10.5px]" style={{ color: "var(--steel-dim)" }}>
                ราคาปัจจุบัน
              </span>
            </div>
          </div>
        </div>

        <div className="mt-[26px] flex flex-wrap justify-center gap-[10px]">
          <Link href={`/listings/${result.id}`} className="min-w-[160px] flex-1 rounded-[11px] py-3 text-center text-[14px] font-medium no-underline" style={{ background: "var(--blue)", color: "#071523" }}>
            ดูประกาศของคุณ
          </Link>
          <Link href="/profile" className="min-w-[160px] flex-1 rounded-[11px] py-3 text-center text-[14px] font-medium no-underline" style={{ background: "transparent", border: "1px solid rgba(140,147,163,0.25)", color: "var(--steel)" }}>
            กลับไปโปรไฟล์
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <h2 className="mb-3 text-[14px] font-medium" style={{ color: "var(--steel)" }}>
        รูปภาพการ์ด
      </h2>
      <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
        <div className="grid grid-cols-2 gap-[14px] max-[420px]:grid-cols-1">
          <PhotoSlot label="ด้านหน้า" file={front} onPick={(f) => { setFront(f); setPhotoError(false); }} onRemove={() => setFront(null)} />
          <PhotoSlot label="ด้านหลัง" file={back} onPick={(f) => { setBack(f); setPhotoError(false); }} onRemove={() => setBack(null)} />
        </div>
        {photoError && (
          <p className="mt-2 text-[12px]" style={{ color: "var(--danger)" }}>
            อัปโหลดรูปทั้งด้านหน้าและด้านหลังก่อนเผยแพร่ประกาศ
          </p>
        )}
      </div>

      <h2 className="mb-3 mt-6 text-[14px] font-medium" style={{ color: "var(--steel)" }}>
        รายละเอียดการ์ด
      </h2>
      <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
        <div>
          <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
            ชื่อการ์ด
          </label>
          <input style={inputStyle} value={name} onChange={(e) => { setName(e.target.value); setDetailsError(false); }} placeholder="เช่น Dragonic Overlord SP" />
        </div>
        <div className="mt-[14px] grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
          <div>
            <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
              ชุด
            </label>
            <input style={inputStyle} value={set} onChange={(e) => { setSet(e.target.value); setDetailsError(false); }} placeholder="เช่น Vanguard DZ-BT01" />
          </div>
          <div>
            <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
              หมวดหมู่
            </label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setDetailsError(false); }}
              style={{ ...inputStyle, color: category ? "var(--white)" : "var(--steel-dim)" }}
            >
              <option value="">เลือกหมวดหมู่</option>
              <option value="new">บูสเตอร์ใหม่</option>
              <option value="deck">เด็คพร้อมเล่น</option>
              <option value="rare">การ์ดหายาก</option>
            </select>
          </div>
        </div>
        <div className="mt-[14px]">
          <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
            สภาพการ์ด
          </label>
          <select
            value={condition}
            onChange={(e) => { setCondition(e.target.value); setDetailsError(false); }}
            style={{ ...inputStyle, color: condition ? "var(--white)" : "var(--steel-dim)" }}
          >
            <option value="">เลือกสภาพการ์ด</option>
            <option>สภาพสมบูรณ์ (Near Mint)</option>
            <option>สภาพดีมาก (Excellent)</option>
            <option>สภาพดี (Good)</option>
            <option>มีตำหนิเล็กน้อย (Light Play)</option>
            <option>มีตำหนิชัดเจน (Damaged)</option>
          </select>
        </div>
        <div className="mt-[14px]">
          <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
            รายละเอียดเพิ่มเติม (ไม่บังคับ)
          </label>
          <textarea
            maxLength={400}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="เช่น แกะจากกล่องแล้วเก็บใส่สลีฟทันที มุมคมทุกด้าน"
            className="w-full resize-y rounded-[10px] p-[11px] text-[14.5px] leading-relaxed outline-none"
            style={{ background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--white)", minHeight: 76 }}
          />
        </div>
        {detailsError && (
          <p className="mt-2 text-[12px]" style={{ color: "var(--danger)" }}>
            กรอกชื่อการ์ด ชุด หมวดหมู่ และสภาพการ์ดให้ครบ
          </p>
        )}
      </div>

      <h2 className="mb-3 mt-6 text-[14px] font-medium" style={{ color: "var(--steel)" }}>
        ราคาและระยะเวลา
      </h2>
      <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
        <div className="mb-[18px] grid grid-cols-2 gap-2 rounded-xl p-1" style={{ background: "var(--panel-2)" }}>
          {(
            [
              ["auction", "ประมูล"],
              ["sell", "ขายทันที"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => { setMode(key); setPriceError(false); }}
              className="rounded-lg py-[9px] text-[13.5px] font-medium transition-colors"
              style={
                mode === key
                  ? { background: "var(--blue)", color: "#071523" }
                  : { background: "transparent", color: "var(--steel)" }
              }
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "auction" ? (
          <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
            <div>
              <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
                ราคาเริ่มต้น
              </label>
              <div className="relative">
                <span className="mono pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[14.5px]" style={{ color: "var(--steel)" }}>
                  ฿
                </span>
                <input
                  className="mono"
                  style={{ ...inputStyle, paddingLeft: 30 }}
                  inputMode="numeric"
                  value={startPrice}
                  onChange={(e) => { setStartPrice(e.target.value.replace(/\D/g, "")); setPriceError(false); }}
                  placeholder="1,000"
                />
              </div>
            </div>
            <div>
              <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
                ระยะเวลาประมูล
              </label>
              <select value={duration} onChange={(e) => setDuration(e.target.value)} style={{ ...inputStyle, color: "var(--white)" }}>
                <option value="1">1 วัน</option>
                <option value="3">3 วัน</option>
                <option value="5">5 วัน</option>
                <option value="7">7 วัน</option>
              </select>
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
              ราคาขายทันที
            </label>
            <div className="relative">
              <span className="mono pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[14.5px]" style={{ color: "var(--steel)" }}>
                ฿
              </span>
              <input
                className="mono"
                style={{ ...inputStyle, paddingLeft: 30 }}
                inputMode="numeric"
                value={sellPrice}
                onChange={(e) => { setSellPrice(e.target.value.replace(/\D/g, "")); setPriceError(false); }}
                placeholder="6,500"
              />
            </div>
            <p className="mt-2 text-[12px]" style={{ color: "var(--steel-dim)" }}>
              ผู้ซื้อกดซื้อได้ทันทีในราคานี้ ไม่มีการประมูล
            </p>
          </div>
        )}

        {priceError && (
          <p className="mt-2 text-[12px]" style={{ color: "var(--danger)" }}>
            กรอกราคาก่อนเผยแพร่ประกาศ
          </p>
        )}
      </div>

      {mode === "auction" && (
        <div className="mt-[22px] flex items-start gap-[10px] rounded-xl px-4 py-[13px]" style={{ background: "rgba(95,212,255,0.06)", border: "1px solid rgba(95,212,255,0.2)" }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: "var(--cyan)", flexShrink: 0, marginTop: 1 }}>
            <path d="M10 6.5v4M10 13.2v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--steel)" }}>
            <strong style={{ color: "var(--white)", fontWeight: 500 }}>รูปภาพจะถูกล็อกทันทีที่มีคนบิด</strong> — แก้ไขรูปหลังจากนั้นไม่ได้ เพื่อป้องกันการสลับการ์ดหลังปิดประมูล
          </p>
        </div>
      )}

      {submitError && (
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--danger)" }}>
          {submitError}
        </p>
      )}
      <button
        type="button"
        onClick={handlePublish}
        disabled={submitting}
        className="mt-[22px] h-[52px] w-full rounded-xl text-[15.5px] font-semibold"
        style={{ background: "var(--blue)", color: "#071523" }}
      >
        {submitting ? "..." : "เผยแพร่ประกาศ"}
      </button>
    </>
  );
}
