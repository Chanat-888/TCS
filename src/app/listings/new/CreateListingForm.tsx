"use client";

import { useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { formatTHB } from "@/lib/format";
import { OTHER_RARITY, PRODUCT_TYPE_LABELS, VANGUARD_RARITIES } from "@/lib/vanguard";

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
  const [rarity, setRarity] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [hasExtras, setHasExtras] = useState("");
  const [startPrice, setStartPrice] = useState("");
  const [duration, setDuration] = useState("72");
  // Custom end time is always Thai time (UTC+7), independent of the browser's locale/timezone.
  const [endDate, setEndDate] = useState("");
  const [endHour, setEndHour] = useState("18");
  const [endMinute, setEndMinute] = useState("00");
  const [endDates] = useState(() => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
    const [y, m, d] = today.split("-").map(Number);
    return Array.from({ length: 31 }, (_, i) => {
      const day = new Date(Date.UTC(y, m - 1, d + i));
      const value = day.toISOString().slice(0, 10);
      const label =
        i === 0
          ? "วันนี้"
          : i === 1
            ? "พรุ่งนี้"
            : day.toLocaleDateString("th-TH", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });
      return { value, label };
    });
  });
  const customEndIso = endDate ? `${endDate}T${endHour}:${endMinute}:00+07:00` : "";
  const [bidIncrement, setBidIncrement] = useState("100");
  const [instantWinPrice, setInstantWinPrice] = useState("");
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
    if ((category === "rare" && !rarity) || (category === "deck" && !hasExtras)) {
      setDetailsError(true);
      return;
    }
    setDetailsError(false);
    const price = mode === "sell" ? sellPrice : startPrice;
    if (!price.trim()) {
      setPriceError(true);
      return;
    }
    if (mode === "auction" && duration === "custom") {
      const end = new Date(customEndIso).getTime();
      const untilEnd = end - Date.now();
      if (!customEndIso || Number.isNaN(end) || untilEnd < 60 * 60 * 1000 - 60_000 || untilEnd > 30 * 24 * 60 * 60 * 1000) {
        setSubmitError("เวลาปิดประมูลต้องอยู่ระหว่าง 1 ชั่วโมง ถึง 30 วันจากตอนนี้");
        return;
      }
    }
    if (mode === "auction" && instantWinPrice.trim() && Number(instantWinPrice) <= Number(startPrice)) {
      setSubmitError("ราคาชนะทันทีต้องสูงกว่าราคาเริ่มต้น");
      return;
    }
    if (mode === "auction") {
      const step = Number(bidIncrement);
      if (!Number.isInteger(step) || step < 5 || step > 1000) {
        setSubmitError("บิดขั้นต่ำต้องอยู่ระหว่าง ฿5 – ฿1,000");
        return;
      }
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
    formData.append("rarity", rarity);
    formData.append("quantity", quantity);
    formData.append("hasExtras", hasExtras);
    formData.append("condition", condition);
    formData.append("description", description.trim());
    if (mode === "sell") {
      formData.append("startPrice", sellPrice);
      formData.append("buyNowPrice", sellPrice);
    } else {
      formData.append("startPrice", startPrice);
      if (duration === "custom") formData.append("endsAt", new Date(customEndIso).toISOString());
      else formData.append("durationHours", duration);
      formData.append("bidIncrement", bidIncrement);
      if (instantWinPrice.trim()) formData.append("buyNowPrice", instantWinPrice);
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
            ชื่อการ์ด / สินค้า
          </label>
          <input style={inputStyle} value={name} onChange={(e) => { setName(e.target.value); setDetailsError(false); }} placeholder="เช่น Dragonic Overlord SP หรือ Starter Deck / กล่อง BT" />
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
              ประเภทสินค้า
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setQuantity("1");
                setDetailsError(false);
              }}
              style={{ ...inputStyle, color: category ? "var(--white)" : "var(--steel-dim)" }}
            >
              <option value="">เลือกประเภทสินค้า</option>
              <option value="rare">{PRODUCT_TYPE_LABELS.rare}</option>
              <option value="deck">{PRODUCT_TYPE_LABELS.deck}</option>
              <option value="new">{PRODUCT_TYPE_LABELS.new}</option>
            </select>
          </div>
        </div>
        {category === "rare" && (
          <div className="mt-[14px] grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
            <div>
              <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
                ความหายาก
              </label>
              <select
                value={rarity}
                onChange={(e) => { setRarity(e.target.value); setDetailsError(false); }}
                style={{ ...inputStyle, color: rarity ? "var(--white)" : "var(--steel-dim)" }}
              >
                <option value="">เลือกความหายาก</option>
                {VANGUARD_RARITIES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
                <option value={OTHER_RARITY}>{OTHER_RARITY}</option>
              </select>
            </div>
            <div>
              <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
                จำนวนการ์ด
              </label>
              <select value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ ...inputStyle, color: "var(--white)" }}>
                <option value="1">1 ใบ (แยกใบ)</option>
                <option value="2">เป็นชุด 2 ใบ</option>
                <option value="3">เป็นชุด 3 ใบ</option>
                <option value="4">เป็นชุด 4 ใบ</option>
              </select>
            </div>
          </div>
        )}
        {category === "deck" && (
          <div className="mt-[14px]">
            <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
              อะไหล่ / ส่วนประกอบเสริม
            </label>
            <select
              value={hasExtras}
              onChange={(e) => { setHasExtras(e.target.value); setDetailsError(false); }}
              style={{ ...inputStyle, color: hasExtras ? "var(--white)" : "var(--steel-dim)" }}
            >
              <option value="">เลือก</option>
              <option value="true">มีอะไหล่ (การ์ดหรืออุปกรณ์เสริม)</option>
              <option value="false">ไม่มีอะไหล่ (เด็คเท่านั้น)</option>
            </select>
          </div>
        )}
        {category === "new" && (
          <div className="mt-[14px]">
            <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
              จำนวนกล่อง
            </label>
            <select value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ ...inputStyle, color: "var(--white)" }}>
              {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 24].map((n) => (
                <option key={n} value={String(n)}>{n} กล่อง</option>
              ))}
            </select>
          </div>
        )}
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
            <option>ซีลใหม่ (Sealed)</option>
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
            กรอกชื่อ ชุด ประเภทสินค้า และสภาพให้ครบ (การ์ดแยกใบเลือกความหายาก · เด็คเลือกอะไหล่)
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
          <>
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
                <optgroup label="ประมูลเร็ว (ราคาร้อน)">
                  <option value="1">1 ชั่วโมง</option>
                  <option value="3">3 ชั่วโมง</option>
                  <option value="6">6 ชั่วโมง</option>
                  <option value="12">12 ชั่วโมง</option>
                </optgroup>
                <optgroup label="ประมูลปกติ">
                  <option value="24">1 วัน</option>
                  <option value="72">3 วัน</option>
                  <option value="120">5 วัน</option>
                  <option value="168">7 วัน</option>
                </optgroup>
                <option value="custom">กำหนดวันและเวลาเอง</option>
              </select>
            </div>
            <div>
              <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
                บิดขั้นต่ำต่อครั้ง
              </label>
              <div className="relative">
                <span className="mono pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[14.5px]" style={{ color: "var(--steel)" }}>
                  ฿
                </span>
                <input
                  className="mono"
                  style={{ ...inputStyle, paddingLeft: 30 }}
                  inputMode="numeric"
                  value={bidIncrement}
                  onChange={(e) => { setBidIncrement(e.target.value.replace(/\D/g, "")); setPriceError(false); }}
                  placeholder="100"
                />
              </div>
            </div>
            <div>
              <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
                ราคาชนะทันที (ไม่บังคับ)
              </label>
              <div className="relative">
                <span className="mono pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[14.5px]" style={{ color: "var(--steel)" }}>
                  ฿
                </span>
                <input
                  className="mono"
                  style={{ ...inputStyle, paddingLeft: 30 }}
                  inputMode="numeric"
                  value={instantWinPrice}
                  onChange={(e) => setInstantWinPrice(e.target.value.replace(/\D/g, ""))}
                  placeholder="เว้นว่าง = ไม่มี"
                />
              </div>
            </div>
          </div>
          {duration === "custom" && (
            <div className="mt-3">
              <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
                ปิดประมูลเมื่อ
              </label>
              <div className="grid grid-cols-[1.6fr_1fr_1fr] gap-2">
                <select
                  aria-label="วันที่ปิดประมูล"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setSubmitError(""); }}
                  style={{ ...inputStyle, color: endDate ? "var(--white)" : "var(--steel)" }}
                >
                  <option value="">เลือกวันที่</option>
                  {endDates.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                <select
                  aria-label="ชั่วโมง"
                  value={endHour}
                  onChange={(e) => { setEndHour(e.target.value); setSubmitError(""); }}
                  style={{ ...inputStyle, color: "var(--white)" }}
                >
                  {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")).map((h) => (
                    <option key={h} value={h}>{h} น.</option>
                  ))}
                </select>
                <select
                  aria-label="นาที"
                  value={endMinute}
                  onChange={(e) => { setEndMinute(e.target.value); setSubmitError(""); }}
                  style={{ ...inputStyle, color: "var(--white)" }}
                >
                  {["00", "15", "30", "45"].map((m) => (
                    <option key={m} value={m}>{m} นาที</option>
                  ))}
                </select>
              </div>
              {endDate && (
                <p className="mono mt-2 text-[13px]" style={{ color: "var(--cyan)" }}>
                  ปิดประมูล {endDates.find((d) => d.value === endDate)?.label} เวลา {endHour}.{endMinute} น.
                </p>
              )}
              <p className="mt-2 text-[12px]" style={{ color: "var(--steel-dim)" }}>
                เวลาประเทศไทย เลือกได้ตั้งแต่ 1 ชั่วโมง ถึง 30 วันจากตอนนี้ · ถ้ามีคนบิดในช่วง 2 นาทีสุดท้าย เวลาจะขยายให้อัตโนมัติ
              </p>
            </div>
          )}
          <p className="mt-2 text-[12px]" style={{ color: "var(--steel-dim)" }}>
            บิดขั้นต่ำตั้งได้ ฿5 – ฿1,000 ต่อครั้ง · ถ้าตั้งราคาชนะทันที ผู้ซื้อที่บิดถึงราคานี้จะชนะและปิดประมูลทันที
          </p>
          </>
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
