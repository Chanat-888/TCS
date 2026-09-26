"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { prepareCardPhoto } from "@/lib/clientImage";
import { postForm } from "@/lib/postForm";
import { formatTHB } from "@/lib/format";
import { CONDITION_OPTIONS, OTHER_RARITY, VANGUARD_RARITIES } from "@/lib/vanguard";
import { MAX_ITEM_NUMBER, MAX_SPREAD_ITEMS, MAX_SPREAD_PHOTOS, MAX_SPREAD_UPLOAD_BYTES, cheapestPrice } from "@/lib/spreadPost";

interface EditorPhoto {
  file: File;
  url: string;
}

interface EditorItem {
  key: string;
  number: string;
  name: string;
  rarity: string;
  condition: string;
  price: string;
}

const fieldStyle = {
  background: "var(--panel-2)",
  border: "1px solid rgba(140,147,163,0.2)",
  color: "var(--white)",
} as const;
const input = "min-h-11 w-full rounded-[10px] px-3 text-[14px] outline-none";

/**
 * Seller's editor for a spread post: upload the photo(s) of the cards laid out, write
 * a number next to each card in real life, then list each card by that number with
 * its name, rarity, condition and price.
 */
export function SpreadEditor() {
  const [photos, setPhotos] = useState<EditorPhoto[]>([]);
  const [items, setItems] = useState<EditorItem[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState<{ id: string; itemCount: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<string[]>([]);

  // Object URLs are created when a photo is added and revoked when it is removed or
  // the editor goes away.
  useEffect(() => {
    urlsRef.current = photos.map((p) => p.url);
  }, [photos]);
  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const usedBytes = photos.reduce((sum, p) => sum + p.file.size, 0);

  async function addPhoto(picked: File) {
    setPhotoError("");
    setPreparing(true);
    // Bigger than a normal card photo, so the cards in it stay readable.
    const result = await prepareCardPhoto(picked, { maxSide: 1800, quality: 0.8 });
    setPreparing(false);
    if (!result.ok) {
      setPhotoError(result.error);
      return;
    }
    if (usedBytes + result.file.size > MAX_SPREAD_UPLOAD_BYTES) {
      setPhotoError("รูปรวมกันใหญ่เกินไป ลบรูปเดิมหรือเลือกรูปที่เล็กลง");
      return;
    }
    setPhotos((prev) => [...prev, { file: result.file, url: URL.createObjectURL(result.file) }]);
  }

  function removePhoto(index: number) {
    const photo = photos[index];
    if (photo) URL.revokeObjectURL(photo.url);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function nextNumber(list: EditorItem[]) {
    const used = new Set(list.map((i) => Number(i.number)));
    for (let n = 1; n <= MAX_ITEM_NUMBER; n++) if (!used.has(n)) return String(n);
    return "";
  }

  function addItem() {
    if (items.length >= MAX_SPREAD_ITEMS) {
      setError(`ใส่การ์ดได้สูงสุด ${MAX_SPREAD_ITEMS} ใบต่อโพสต์`);
      return;
    }
    setError("");
    const previous = items[items.length - 1];
    setItems((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        number: nextNumber(prev),
        name: "",
        // The next card is usually the same rarity/condition as the last: save the seller a tap.
        rarity: previous?.rarity ?? "",
        condition: previous?.condition ?? CONDITION_OPTIONS[1],
        price: "",
      },
    ]);
  }

  function patch(key: string, changes: Partial<EditorItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...changes } : i)));
  }

  async function publish() {
    setError("");
    if (photos.length === 0) return setError("อัปโหลดรูปการ์ดอย่างน้อย 1 รูป");
    if (title.trim().length < 3) return setError("ตั้งชื่อโพสต์ (อย่างน้อย 3 ตัวอักษร)");
    if (items.length === 0) return setError("เพิ่มการ์ดอย่างน้อย 1 ใบ");
    const seen = new Set<number>();
    for (const [index, item] of items.entries()) {
      const label = `การ์ดแถวที่ ${index + 1}`;
      const number = Number(item.number);
      if (!Number.isInteger(number) || number < 1 || number > MAX_ITEM_NUMBER) return setError(`${label}: หมายเลขต้องเป็น 1 – ${MAX_ITEM_NUMBER}`);
      if (seen.has(number)) return setError(`${label}: หมายเลข ${number} ซ้ำกัน`);
      seen.add(number);
      if (!item.name.trim()) return setError(`${label}: กรอกชื่อการ์ด`);
      if (!item.rarity) return setError(`${label}: เลือกความหายาก`);
      const price = Number(item.price);
      if (!Number.isInteger(price) || price < 1) return setError(`${label}: กรอกราคา (จำนวนเต็ม)`);
    }

    setPublishing(true);
    const formData = new FormData();
    photos.forEach((p, i) => formData.append(`photo${i}`, p.file));
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append(
      "items",
      JSON.stringify(
        [...items]
          .sort((a, b) => Number(a.number) - Number(b.number))
          .map((i) => ({ position: Number(i.number), name: i.name.trim(), rarity: i.rarity, condition: i.condition, price: Number(i.price) }))
      )
    );
    const sent = await postForm<{ id: string; itemCount: number }>("/api/listings/spread", formData);
    setPublishing(false);
    if (!sent.ok) {
      setError(sent.error || "เผยแพร่โพสต์ไม่สำเร็จ");
      return;
    }
    setDone(sent.data);
    window.scrollTo({ top: 0 });
  }

  if (done) {
    return (
      <div className="py-8 text-center">
        <p className="text-[18px] font-medium" style={{ color: "var(--good)" }}>เผยแพร่โพสต์แล้ว</p>
        <p className="mt-2 text-[13.5px]" style={{ color: "var(--steel)" }}>
          ผู้ซื้อเลือกการ์ดทั้ง {done.itemCount} ใบได้เป็นใบ ๆ
        </p>
        <Link
          href={`/listings/${done.id}`}
          className="mt-5 inline-flex min-h-12 items-center rounded-[11px] px-6 text-[14.5px] font-semibold no-underline"
          style={{ background: "var(--blue)", color: "#071523" }}
        >
          ดูโพสต์ของคุณ
        </Link>
      </div>
    );
  }

  const prices = items.map((i) => ({ price: Number(i.price) || Infinity }));
  const lowest = items.length > 0 ? cheapestPrice(prices) : Infinity;

  return (
    <div>
      <h2 className="mb-3 text-[14px] font-medium" style={{ color: "var(--steel)" }}>1. รูปการ์ด (วางการ์ดหลายใบในรูปเดียว)</h2>
      <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
        <p className="mb-3 text-[12.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
          <strong style={{ color: "var(--white)", fontWeight: 500 }}>เคล็ดลับ:</strong> วางกระดาษเขียนเลข 1, 2, 3 … ไว้ข้างการ์ดแต่ละใบก่อนถ่ายรูป
          แล้วลงรายการด้านล่างตามเลขเดียวกัน ผู้ซื้อจะเลือกจากเลขในรายการได้ง่าย
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const picked = e.target.files?.[0];
            e.target.value = "";
            if (picked) addPhoto(picked);
          }}
        />

        {photos.length > 0 && (
          <div className="flex flex-col gap-3">
            {photos.map((photo, index) => (
              <div key={photo.url} className="relative overflow-hidden rounded-xl" style={{ border: "1px solid var(--line)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={`รูปที่ ${index + 1}`} className="block h-auto w-full" />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  aria-label={`ลบรูปที่ ${index + 1}`}
                  className="absolute right-2 top-2 flex min-h-11 min-w-11 items-center justify-center rounded-lg"
                  style={{ background: "rgba(10,12,16,0.75)", border: "1px solid rgba(140,147,163,0.25)", color: "var(--danger)" }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {photos.length < MAX_SPREAD_PHOTOS && (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={preparing}
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl px-4 text-center text-[13.5px] ${photos.length === 0 ? "min-h-[140px]" : "mt-3 min-h-11"}`}
            style={{ border: "1.5px dashed rgba(140,147,163,0.28)", color: "var(--steel)" }}
          >
            {preparing ? "กำลังเตรียมรูป…" : photos.length === 0 ? "แตะเพื่ออัปโหลดรูป" : "+ เพิ่มรูป"}
          </button>
        )}
        {photos.length > 0 && (
          <p className="mt-2 text-[12px]" style={{ color: "var(--steel)" }}>
            {photos.length}/{MAX_SPREAD_PHOTOS} รูป · ใช้ {(usedBytes / 1024 / 1024).toFixed(1)} จาก {MAX_SPREAD_UPLOAD_BYTES / 1024 / 1024} MB
          </p>
        )}
        {photoError && (
          <p className="mt-2 text-[12.5px]" style={{ color: "var(--danger)" }}>{photoError}</p>
        )}
      </div>

      <h2 className="mb-3 mt-6 text-[14px] font-medium" style={{ color: "var(--steel)" }}>2. รายการการ์ดแต่ละใบ ({items.length}/{MAX_SPREAD_ITEMS})</h2>
      {items.length === 0 ? (
        <p className="rounded-2xl p-4 text-[13px]" style={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--steel)" }}>
          ยังไม่มีการ์ด — กด “เพิ่มการ์ด” เพื่อลงรายการใบแรก
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => (
            <li key={item.key} className="rounded-2xl p-3" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
              <div className="flex items-center gap-2">
                <div className="relative w-[84px] flex-shrink-0">
                  <span className="mono pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px]" style={{ color: "var(--cyan)" }}>#</span>
                  <input
                    aria-label={`หมายเลขการ์ดแถวที่ ${index + 1}`}
                    className={`${input} mono`}
                    style={{ ...fieldStyle, paddingLeft: 26 }}
                    inputMode="numeric"
                    value={item.number}
                    onChange={(e) => patch(item.key, { number: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                  />
                </div>
                <input
                  aria-label={`ชื่อการ์ดแถวที่ ${index + 1}`}
                  className={input}
                  style={fieldStyle}
                  value={item.name}
                  maxLength={80}
                  onChange={(e) => patch(item.key, { name: e.target.value })}
                  placeholder="ชื่อการ์ด เช่น Blaster Blade"
                />
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                  aria-label={`ลบการ์ดแถวที่ ${index + 1}`}
                  className="min-h-11 min-w-11 flex-shrink-0 rounded-[10px]"
                  style={{ background: "transparent", border: "1px solid var(--danger-line)", color: "var(--danger)" }}
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 max-[520px]:grid-cols-1">
                <select
                  aria-label={`ความหายากแถวที่ ${index + 1}`}
                  className={input}
                  style={{ ...fieldStyle, color: item.rarity ? "var(--white)" : "var(--steel-dim)" }}
                  value={item.rarity}
                  onChange={(e) => patch(item.key, { rarity: e.target.value })}
                >
                  <option value="">ความหายาก</option>
                  {VANGUARD_RARITIES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                  <option value={OTHER_RARITY}>{OTHER_RARITY}</option>
                </select>
                <select
                  aria-label={`สภาพแถวที่ ${index + 1}`}
                  className={input}
                  style={fieldStyle}
                  value={item.condition}
                  onChange={(e) => patch(item.key, { condition: e.target.value })}
                >
                  {CONDITION_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <div className="relative">
                  <span className="mono pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px]" style={{ color: "var(--steel)" }}>฿</span>
                  <input
                    aria-label={`ราคาแถวที่ ${index + 1}`}
                    className={`${input} mono`}
                    style={{ ...fieldStyle, paddingLeft: 28 }}
                    inputMode="numeric"
                    value={item.price}
                    onChange={(e) => patch(item.key, { price: e.target.value.replace(/\D/g, "") })}
                    placeholder="ราคา"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={addItem}
        className="mt-3 min-h-12 w-full rounded-[11px] text-[14px] font-medium"
        style={{ background: "var(--panel)", border: "1px solid var(--cyan-line)", color: "var(--cyan)" }}
      >
        + เพิ่มการ์ด
      </button>

      <h2 className="mb-3 mt-6 text-[14px] font-medium" style={{ color: "var(--steel)" }}>3. ชื่อโพสต์</h2>
      <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
        <input
          className={input}
          style={fieldStyle}
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="เช่น การ์ด Vanguard ราคาถูก เลือกได้เป็นใบ"
        />
        <textarea
          value={description}
          maxLength={400}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ) เช่น ส่งรวมกันได้ในพัสดุเดียว"
          className="mt-3 w-full resize-y rounded-[10px] p-[11px] text-[14px] leading-relaxed outline-none"
          style={{ ...fieldStyle, minHeight: 76 }}
        />
        {Number.isFinite(lowest) && (
          <p className="mt-3 text-[12.5px]" style={{ color: "var(--steel)" }}>
            หน้าแรกจะแสดง “เริ่ม {formatTHB(lowest)}” ตามการ์ดใบที่ถูกที่สุด · ขายราคาตายตัว ไม่มีประมูล · ผู้ซื้อหลายใบจะได้ 1 คำสั่งซื้อ 1 พัสดุ
          </p>
        )}
      </div>

      {error && <p className="mt-4 text-[13px]" style={{ color: "var(--danger)" }}>{error}</p>}
      <button
        type="button"
        onClick={publish}
        disabled={publishing || preparing}
        className="mt-5 min-h-12 w-full rounded-[11px] text-[14.5px] font-semibold disabled:opacity-60"
        style={{ background: "var(--blue)", color: "#071523" }}
      >
        {publishing ? "กำลังเผยแพร่…" : "เผยแพร่โพสต์"}
      </button>
    </div>
  );
}
