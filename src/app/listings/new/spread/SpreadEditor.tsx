"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PhotoAdjustModal, type AdjustResult } from "@/components/PhotoAdjustModal";
import { prepareCardPhoto } from "@/lib/clientImage";
import { transformPins } from "@/lib/photoEdit";
import { postForm } from "@/lib/postForm";
import { formatTHB } from "@/lib/format";
import { CONDITION_OPTIONS, OTHER_RARITY, VANGUARD_RARITIES } from "@/lib/vanguard";
import { MAX_SPREAD_ITEMS, MAX_SPREAD_PHOTOS, MAX_SPREAD_UPLOAD_BYTES, cheapestPrice } from "@/lib/spreadPost";

interface EditorPhoto {
  file: File;
  url: string;
}

interface EditorItem {
  key: string;
  photoIndex: number;
  x: number;
  y: number;
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
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

// Row keys only need to be unique within this editor. (crypto.randomUUID is not available
// on plain-http pages, e.g. when the site is opened from a phone by its network address.)
let keyCounter = 0;
const newKey = () => `pin-${Date.now().toString(36)}-${keyCounter++}`;

/**
 * Seller's editor for a spread post: upload the photo(s) of the cards laid out, tap
 * once on each card to drop a numbered pin (drag to nudge it), then give each card its
 * name, rarity, condition and price. The numbers follow the order of the pins.
 */
export function SpreadEditor() {
  const [photos, setPhotos] = useState<EditorPhoto[]>([]);
  const [activePhoto, setActivePhoto] = useState(0);
  const [items, setItems] = useState<EditorItem[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [notice, setNotice] = useState("");
  const [adjusting, setAdjusting] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState<{ id: string; itemCount: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<string | null>(null);
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
    setNotice("");
    setPhotos((prev) => [...prev, { file: result.file, url: URL.createObjectURL(result.file) }]);
    setActivePhoto(photos.length);
  }

  function removePhoto(index: number) {
    const photo = photos[index];
    if (photo) URL.revokeObjectURL(photo.url);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    // Cards pinned on the removed photo go with it; later photos shift down by one.
    setItems((prev) => prev.filter((i) => i.photoIndex !== index).map((i) => (i.photoIndex > index ? { ...i, photoIndex: i.photoIndex - 1 } : i)));
    setActivePhoto(0);
    setSelectedKey(null);
  }

  // Rotating or cropping a photo moves its cards, so the pins on it follow: each pin is
  // carried through the same turn and crop, and any pin whose card was cropped out goes.
  function applyAdjust(index: number, result: AdjustResult) {
    const old = photos[index];
    setAdjusting(null);
    if (!old) return;
    if (usedBytes - old.file.size + result.file.size > MAX_SPREAD_UPLOAD_BYTES) {
      setPhotoError("รูปรวมกันใหญ่เกินไป ลองตัดรูปให้เล็กลงหรือลบรูปอื่น");
      return;
    }
    setPhotoError("");
    URL.revokeObjectURL(old.url);
    setPhotos((prev) => prev.map((p, i) => (i === index ? { file: result.file, url: URL.createObjectURL(result.file) } : p)));

    const onPhoto = items.filter((i) => i.photoIndex === index);
    const moved = transformPins(onPhoto.map((i) => ({ x: i.x, y: i.y })), result.turns, result.crop);
    const movedByKey = new Map(onPhoto.map((item, n) => [item.key, moved[n]]));
    let dropped = 0;
    setItems(
      items.flatMap((item) => {
        const m = movedByKey.get(item.key);
        if (!m) return [item];
        if (!m.kept) {
          dropped++;
          return [];
        }
        return [{ ...item, x: m.x, y: m.y }];
      })
    );
    if (selectedKey && movedByKey.get(selectedKey)?.kept === false) setSelectedKey(null);
    setNotice(dropped > 0 ? `ลบการ์ด ${dropped} ใบที่อยู่นอกพื้นที่ที่ตัดออกแล้ว` : "");
  }

  function pointOf(clientX: number, clientY: number) {
    const rect = stage.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return { x: round1(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100)), y: round1(clamp(((clientY - rect.top) / rect.height) * 100, 0, 100)) };
  }

  function addPin(clientX: number, clientY: number) {
    if (items.length >= MAX_SPREAD_ITEMS) {
      setError(`ใส่การ์ดได้สูงสุด ${MAX_SPREAD_ITEMS} ใบต่อโพสต์`);
      return;
    }
    const point = pointOf(clientX, clientY);
    if (!point) return;
    setError("");
    const previous = items[items.length - 1];
    const key = newKey();
    setItems((prev) => [
      ...prev,
      {
        key,
        photoIndex: activePhoto,
        ...point,
        name: "",
        // The next card is usually the same rarity/condition as the last: save the seller a tap.
        rarity: previous?.rarity ?? "",
        condition: previous?.condition ?? CONDITION_OPTIONS[1],
        price: "",
      },
    ]);
    setSelectedKey(key);
  }

  function patch(key: string, changes: Partial<EditorItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...changes } : i)));
  }

  function remove(key: string) {
    // The numbers close up: pins after the removed one move down by one.
    setItems((prev) => prev.filter((i) => i.key !== key));
    if (selectedKey === key) setSelectedKey(null);
  }

  async function publish() {
    setError("");
    if (photos.length === 0) return setError("อัปโหลดรูปการ์ดอย่างน้อย 1 รูป");
    if (title.trim().length < 3) return setError("ตั้งชื่อโพสต์ (อย่างน้อย 3 ตัวอักษร)");
    if (items.length === 0) return setError("แตะบนรูปเพื่อปักหมุดการ์ดอย่างน้อย 1 ใบ");
    for (const [index, item] of items.entries()) {
      const label = `การ์ดใบที่ ${index + 1}`;
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
        items.map((i) => ({ photoIndex: i.photoIndex, x: i.x, y: i.y, name: i.name.trim(), rarity: i.rarity, condition: i.condition, price: Number(i.price) }))
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

  const pins = items.map((item, index) => ({ item, number: index + 1 })).filter(({ item }) => item.photoIndex === activePhoto);
  const prices = items.map((i) => ({ price: Number(i.price) || Infinity }));
  const lowest = items.length > 0 ? cheapestPrice(prices) : Infinity;

  return (
    <div>
      <h2 className="mb-3 text-[14px] font-medium" style={{ color: "var(--steel)" }}>1. รูปการ์ด (วางการ์ดหลายใบในรูปเดียว)</h2>
      <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
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

        {photos.length > 1 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {photos.map((_, index) => (
              <span key={index} className="inline-flex overflow-hidden rounded-full" style={{ border: "1px solid var(--line)" }}>
                <button
                  type="button"
                  onClick={() => setActivePhoto(index)}
                  className="min-h-11 px-4 text-[13px]"
                  style={index === activePhoto ? { background: "var(--blue)", color: "#071523", fontWeight: 600 } : { background: "var(--panel-2)", color: "var(--steel)" }}
                >
                  รูปที่ {index + 1}
                </button>
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  aria-label={`ลบรูปที่ ${index + 1}`}
                  className="min-h-11 px-3 text-[13px]"
                  style={{ background: "var(--panel-2)", color: "var(--danger)" }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        {photos[activePhoto] ? (
          <>
            <div
              ref={stage}
              className="relative touch-none overflow-hidden rounded-xl"
              style={{ border: "1px solid var(--line)", cursor: "crosshair" }}
              onClick={(e) => addPin(e.clientX, e.clientY)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photos[activePhoto].url} alt="รูปการ์ดทั้งหมด" className="block h-auto w-full select-none" draggable={false} />
              {pins.map(({ item, number }) => {
                const isSelected = item.key === selectedKey;
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-label={`หมุดการ์ดใบที่ ${number}`}
                    onClick={(e) => { e.stopPropagation(); setSelectedKey(item.key); }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      drag.current = item.key;
                      setSelectedKey(item.key);
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      if (drag.current !== item.key) return;
                      const point = pointOf(e.clientX, e.clientY);
                      if (point) patch(item.key, point);
                    }}
                    onPointerUp={() => { drag.current = null; }}
                    onPointerCancel={() => { drag.current = null; }}
                    className="mono absolute flex touch-none items-center justify-center rounded-full text-[13px] font-semibold"
                    style={{
                      left: `${item.x}%`,
                      top: `${item.y}%`,
                      width: 34,
                      height: 34,
                      transform: "translate(-50%, -50%)",
                      border: "2px solid #fff",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.55)",
                      background: isSelected ? "var(--gold)" : "var(--cyan)",
                      color: "#071523",
                      cursor: "grab",
                    }}
                  >
                    {number}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
              <strong style={{ color: "var(--white)", fontWeight: 500 }}>แตะที่การ์ดแต่ละใบบนรูป</strong> เพื่อปักหมุด (หมายเลขขึ้นให้อัตโนมัติ) ·
              <strong style={{ color: "var(--white)", fontWeight: 500 }}> ลากหมุด</strong> เพื่อขยับ
            </p>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={preparing}
            className="flex min-h-[140px] w-full items-center justify-center rounded-xl px-4 text-center text-[13.5px]"
            style={{ border: "1.5px dashed rgba(140,147,163,0.28)", color: "var(--steel)" }}
          >
            {preparing ? "กำลังเตรียมรูป…" : "แตะเพื่ออัปโหลดรูป (วางการ์ดที่จะขายกระจายในรูปเดียว)"}
          </button>
        )}

        {photos.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {photos.length < MAX_SPREAD_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={preparing}
                className="min-h-11 rounded-[10px] px-4 text-[13.5px]"
                style={{ background: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--white)" }}
              >
                {preparing ? "กำลังเตรียมรูป…" : "+ เพิ่มรูป"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setAdjusting(activePhoto)}
              disabled={preparing}
              className="min-h-11 rounded-[10px] px-4 text-[13.5px]"
              style={{ background: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--white)" }}
            >
              ↻ หมุน / ตัดรูป
            </button>
            {photos.length === 1 && (
              <button
                type="button"
                onClick={() => removePhoto(0)}
                className="min-h-11 rounded-[10px] px-4 text-[13.5px]"
                style={{ background: "transparent", border: "1px solid var(--danger-line)", color: "var(--danger)" }}
              >
                ลบรูป
              </button>
            )}
            <span className="text-[12px]" style={{ color: "var(--steel)" }}>
              {photos.length}/{MAX_SPREAD_PHOTOS} รูป · ใช้ {(usedBytes / 1024 / 1024).toFixed(1)} จาก {MAX_SPREAD_UPLOAD_BYTES / 1024 / 1024} MB
            </span>
          </div>
        )}
        {photoError && (
          <p className="mt-2 text-[12.5px]" style={{ color: "var(--danger)" }}>{photoError}</p>
        )}
        {notice && (
          <p className="mt-2 text-[12.5px]" style={{ color: "var(--gold)" }}>{notice}</p>
        )}
      </div>

      {adjusting !== null && photos[adjusting] && (
        <PhotoAdjustModal
          file={photos[adjusting].file}
          maxSide={1800}
          quality={0.8}
          onCancel={() => setAdjusting(null)}
          onDone={(result) => applyAdjust(adjusting, result)}
        />
      )}

      <h2 className="mb-3 mt-6 text-[14px] font-medium" style={{ color: "var(--steel)" }}>2. รายละเอียดการ์ดแต่ละใบ ({items.length}/{MAX_SPREAD_ITEMS})</h2>
      {items.length === 0 ? (
        <p className="rounded-2xl p-4 text-[13px]" style={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--steel)" }}>
          ยังไม่มีการ์ด — อัปโหลดรูปแล้วแตะที่การ์ดใบแรกบนรูป
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => {
            const isSelected = item.key === selectedKey;
            return (
              <li
                key={item.key}
                className="rounded-2xl p-3"
                style={{ background: "var(--panel)", border: `1px solid ${isSelected ? "var(--gold)" : "rgba(140,147,163,0.14)"}` }}
                onClick={() => { setSelectedKey(item.key); setActivePhoto(item.photoIndex); }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="mono flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
                    style={{ background: isSelected ? "var(--gold)" : "var(--cyan)", color: "#071523" }}
                  >
                    {index + 1}
                  </span>
                  <input
                    aria-label={`ชื่อการ์ดใบที่ ${index + 1}`}
                    className={input}
                    style={fieldStyle}
                    value={item.name}
                    maxLength={80}
                    onChange={(e) => patch(item.key, { name: e.target.value })}
                    placeholder="ชื่อการ์ด เช่น Blaster Blade"
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); remove(item.key); }}
                    aria-label={`ลบการ์ดใบที่ ${index + 1}`}
                    className="min-h-11 min-w-11 flex-shrink-0 rounded-[10px]"
                    style={{ background: "transparent", border: "1px solid var(--danger-line)", color: "var(--danger)" }}
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 max-[520px]:grid-cols-1">
                  <select
                    aria-label={`ความหายากใบที่ ${index + 1}`}
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
                    aria-label={`สภาพใบที่ ${index + 1}`}
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
                      aria-label={`ราคาใบที่ ${index + 1}`}
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
            );
          })}
        </ul>
      )}

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
