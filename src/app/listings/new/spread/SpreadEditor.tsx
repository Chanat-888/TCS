"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ItemThumb } from "@/components/ItemThumb";
import { prepareCardPhoto } from "@/lib/clientImage";
import { postForm } from "@/lib/postForm";
import { formatTHB } from "@/lib/format";
import { CONDITION_OPTIONS, OTHER_RARITY, VANGUARD_RARITIES } from "@/lib/vanguard";
import { MAX_SPREAD_ITEMS, MAX_SPREAD_PHOTOS, MAX_SPREAD_UPLOAD_BYTES, cheapestPrice } from "@/lib/spreadPost";

interface EditorPhoto {
  file: File;
  url: string;
  aspect: number; // height / width
}

interface EditorItem {
  key: string;
  photoIndex: number;
  x: number;
  y: number;
  r: number;
  name: string;
  rarity: string;
  condition: string;
  price: string;
}

const DEFAULT_RADIUS = 8;
const fieldStyle = {
  background: "var(--panel-2)",
  border: "1px solid rgba(140,147,163,0.2)",
  color: "var(--white)",
} as const;
const input = "min-h-11 w-full rounded-[10px] px-3 text-[14px] outline-none";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Seller's editor for a spread post: upload the photo(s) with many cards laid out,
 * tap the photo to drop a numbered circle on each card (drag to move, slider to
 * resize), then give each card its name, rarity, condition and price.
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
  const selected = items.find((i) => i.key === selectedKey) ?? null;

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
    setPhotos((prev) => [...prev, { file: result.file, url: URL.createObjectURL(result.file), aspect: result.height / result.width }]);
    setActivePhoto(photos.length);
  }

  function removePhoto(index: number) {
    const photo = photos[index];
    if (photo) URL.revokeObjectURL(photo.url);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    // Cards on the removed photo go with it; later photos shift down by one.
    setItems((prev) => prev.filter((i) => i.photoIndex !== index).map((i) => (i.photoIndex > index ? { ...i, photoIndex: i.photoIndex - 1 } : i)));
    setActivePhoto(0);
    setSelectedKey(null);
  }

  function pointOf(clientX: number, clientY: number) {
    const rect = stage.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return { x: clamp(((clientX - rect.left) / rect.width) * 100, 0, 100), y: clamp(((clientY - rect.top) / rect.height) * 100, 0, 100) };
  }

  function addMarker(clientX: number, clientY: number) {
    if (items.length >= MAX_SPREAD_ITEMS) {
      setError(`ใส่การ์ดได้สูงสุด ${MAX_SPREAD_ITEMS} ใบต่อโพสต์`);
      return;
    }
    const point = pointOf(clientX, clientY);
    if (!point) return;
    setError("");
    const previous = items[items.length - 1];
    const key = crypto.randomUUID();
    setItems((prev) => [
      ...prev,
      {
        key,
        photoIndex: activePhoto,
        x: Math.round(point.x * 10) / 10,
        y: Math.round(point.y * 10) / 10,
        r: previous?.r ?? DEFAULT_RADIUS,
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
    setItems((prev) => prev.filter((i) => i.key !== key));
    if (selectedKey === key) setSelectedKey(null);
  }

  async function publish() {
    setError("");
    if (photos.length === 0) return setError("อัปโหลดรูปการ์ดอย่างน้อย 1 รูป");
    if (title.trim().length < 3) return setError("ตั้งชื่อโพสต์ (อย่างน้อย 3 ตัวอักษร)");
    if (items.length === 0) return setError("แตะบนรูปเพื่อทำวงกลมครอบการ์ดอย่างน้อย 1 ใบ");
    for (const [index, item] of items.entries()) {
      if (!item.name.trim()) return setError(`การ์ดใบที่ ${index + 1}: กรอกชื่อการ์ด`);
      if (!item.rarity) return setError(`การ์ดใบที่ ${index + 1}: เลือกความหายาก`);
      const price = Number(item.price);
      if (!Number.isInteger(price) || price < 1) return setError(`การ์ดใบที่ ${index + 1}: กรอกราคา (จำนวนเต็ม)`);
    }

    setPublishing(true);
    const formData = new FormData();
    photos.forEach((p, i) => formData.append(`photo${i}`, p.file));
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append(
      "items",
      JSON.stringify(
        items.map((i) => ({
          photoIndex: i.photoIndex,
          aspect: photos[i.photoIndex]?.aspect ?? 1.4,
          x: i.x,
          y: i.y,
          r: i.r,
          name: i.name.trim(),
          rarity: i.rarity,
          condition: i.condition,
          price: Number(i.price),
        }))
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
          ผู้ซื้อเลือกการ์ดทั้ง {done.itemCount} ใบได้เป็นใบ ๆ จากรูปของคุณ
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

  const markers = items.map((item, index) => ({ item, number: index + 1 })).filter(({ item }) => item.photoIndex === activePhoto);

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

        {photos.length > 0 && (
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
          <div
            ref={stage}
            className="relative touch-none overflow-hidden rounded-xl"
            style={{ border: "1px solid var(--line)", cursor: "crosshair" }}
            onClick={(e) => addMarker(e.clientX, e.clientY)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[activePhoto].url} alt="รูปการ์ดทั้งหมด" className="block h-auto w-full select-none" draggable={false} />
            {markers.map(({ item, number }) => {
              const isSelected = item.key === selectedKey;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-label={`การ์ดใบที่ ${number}`}
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
                    if (point) patch(item.key, { x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10 });
                  }}
                  onPointerUp={() => { drag.current = null; }}
                  onPointerCancel={() => { drag.current = null; }}
                  className="absolute touch-none rounded-full"
                  style={{
                    left: `${item.x}%`,
                    top: `${item.y}%`,
                    width: `${item.r * 2}%`,
                    aspectRatio: "1",
                    minWidth: 28,
                    transform: "translate(-50%, -50%)",
                    border: `2.5px solid ${isSelected ? "var(--gold)" : "var(--cyan)"}`,
                    background: isSelected ? "rgba(232,190,80,0.16)" : "rgba(95,212,255,0.08)",
                    cursor: "grab",
                  }}
                >
                  <span
                    className="mono absolute flex items-center justify-center rounded-full text-[11px] font-semibold"
                    style={{ left: -6, top: -6, minWidth: 20, height: 20, padding: "0 4px", background: isSelected ? "var(--gold)" : "var(--cyan)", color: "#071523" }}
                  >
                    {number}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={preparing}
            className="flex min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-xl px-4 text-center text-[13.5px]"
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
            <span className="text-[12px]" style={{ color: "var(--steel)" }}>
              {photos.length}/{MAX_SPREAD_PHOTOS} รูป · ใช้ {(usedBytes / 1024 / 1024).toFixed(1)} จาก {MAX_SPREAD_UPLOAD_BYTES / 1024 / 1024} MB
            </span>
          </div>
        )}
        {photoError && (
          <p className="mt-2 text-[12.5px]" style={{ color: "var(--danger)" }}>{photoError}</p>
        )}

        {photos.length > 0 && (
          <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
            <strong style={{ color: "var(--white)", fontWeight: 500 }}>แตะบนรูป</strong> เพื่อวางวงกลมครอบการ์ดแต่ละใบ ·
            <strong style={{ color: "var(--white)", fontWeight: 500 }}> ลาก</strong> เพื่อขยับ · ปรับขนาดด้วยแถบเลื่อนด้านล่าง
          </p>
        )}

        {selected && (
          <div className="mt-3 flex items-center gap-3">
            <label className="text-[12.5px]" style={{ color: "var(--steel)" }} htmlFor="radius">
              ขนาดวงกลมใบที่ {items.findIndex((i) => i.key === selected.key) + 1}
            </label>
            <input
              id="radius"
              type="range"
              min={3}
              max={20}
              step={0.5}
              value={selected.r}
              onChange={(e) => patch(selected.key, { r: Number(e.target.value) })}
              className="min-h-11 flex-1"
            />
          </div>
        )}
      </div>

      <h2 className="mb-3 mt-6 text-[14px] font-medium" style={{ color: "var(--steel)" }}>2. รายละเอียดการ์ดแต่ละใบ ({items.length}/{MAX_SPREAD_ITEMS})</h2>
      {items.length === 0 ? (
        <p className="rounded-2xl p-4 text-[13px]" style={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--steel)" }}>
          ยังไม่มีการ์ด — อัปโหลดรูปแล้วแตะบนรูปเพื่อเพิ่มการ์ดใบแรก
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
                onClick={() => setSelectedKey(item.key)}
              >
                <div className="flex items-center gap-3">
                  <ItemThumb photoUrl={photos[item.photoIndex]?.url} item={{ x: item.x, y: item.y, r: item.r, aspect: photos[item.photoIndex]?.aspect ?? 1.4 }} size={52} />
                  <span className="mono text-[13px]" style={{ color: "var(--cyan)" }}>#{index + 1}</span>
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
        {items.length > 0 && (
          <p className="mt-3 text-[12.5px]" style={{ color: "var(--steel)" }}>
            หน้าแรกจะแสดง “เริ่ม {Number.isFinite(cheapestPrice(items.map((i) => ({ price: Number(i.price) || Infinity })))) ? formatTHB(cheapestPrice(items.map((i) => ({ price: Number(i.price) || Infinity })))) : "—"}” ตามการ์ดใบที่ถูกที่สุด · ขายราคาตายตัว ไม่มีประมูล · ผู้ซื้อหลายใบจะได้ 1 คำสั่งซื้อ 1 พัสดุ
          </p>
        )}
      </div>

      {error && (
        <p className="mt-4 text-[13px]" style={{ color: "var(--danger)" }}>{error}</p>
      )}
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
