import { OTHER_RARITY, VANGUARD_RARITIES } from "@/lib/vanguard";

/**
 * Rules and geometry for "spread" posts: one big photo with many cards, each card
 * a separately purchasable item marked by a circle.
 */
export const MAX_SPREAD_ITEMS = 30;
// Three photos keeps the whole upload under the ~4.5 MB request cap of our hosting.
export const MAX_SPREAD_PHOTOS = 3;
export const MAX_SPREAD_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_ITEM_PRICE = 1_000_000;
export const SPREAD_POST_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export interface SpreadItemInput {
  photoIndex: number;
  aspect: number;
  x: number;
  y: number;
  r: number;
  name: string;
  rarity: string;
  condition: string;
  price: number;
}

export type ParsedItems = { ok: true; items: SpreadItemInput[] } | { ok: false; error: string };

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
const inRange = (n: number, lo: number, hi: number) => Number.isFinite(n) && n >= lo && n <= hi;

/** Validates the seller's card list. Positions are assigned by order (1, 2, 3 …) by the caller. */
export function parseSpreadItems(raw: unknown, photoCount: number): ParsedItems {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "ทำวงกลมเลือกการ์ดอย่างน้อย 1 ใบบนรูป" };
  if (raw.length > MAX_SPREAD_ITEMS) return { ok: false, error: `ใส่การ์ดได้สูงสุด ${MAX_SPREAD_ITEMS} ใบต่อโพสต์` };

  const items: SpreadItemInput[] = [];
  for (const [index, entry] of raw.entries()) {
    const n = index + 1;
    const e = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const name = typeof e.name === "string" ? e.name.trim() : "";
    const rarity = typeof e.rarity === "string" ? e.rarity.trim() : "";
    const condition = typeof e.condition === "string" ? e.condition.trim() : "";
    const price = num(e.price);
    const photoIndex = num(e.photoIndex);
    const aspect = e.aspect === undefined ? 1.4 : num(e.aspect);
    const x = num(e.x);
    const y = num(e.y);
    const r = num(e.r);

    if (!name || name.length > 80) return { ok: false, error: `การ์ดใบที่ ${n}: กรอกชื่อการ์ด (ไม่เกิน 80 ตัวอักษร)` };
    const knownRarity = (VANGUARD_RARITIES as readonly string[]).includes(rarity) || rarity === OTHER_RARITY;
    if (!knownRarity) return { ok: false, error: `การ์ดใบที่ ${n}: เลือกความหายาก` };
    if (!condition || condition.length > 60) return { ok: false, error: `การ์ดใบที่ ${n}: เลือกสภาพการ์ด` };
    if (!Number.isInteger(price) || price < 1 || price > MAX_ITEM_PRICE) {
      return { ok: false, error: `การ์ดใบที่ ${n}: ราคาต้องเป็นจำนวนเต็ม ฿1 – ฿${MAX_ITEM_PRICE.toLocaleString("en-US")}` };
    }
    if (!Number.isInteger(photoIndex) || photoIndex < 0 || photoIndex >= photoCount) {
      return { ok: false, error: `การ์ดใบที่ ${n}: ตำแหน่งรูปไม่ถูกต้อง` };
    }
    if (!inRange(x, 0, 100) || !inRange(y, 0, 100) || !inRange(r, 2, 30) || !inRange(aspect, 0.2, 5)) {
      return { ok: false, error: `การ์ดใบที่ ${n}: ตำแหน่งวงกลมไม่ถูกต้อง` };
    }
    items.push({ photoIndex, aspect, x, y, r, name, rarity, condition, price });
  }
  return { ok: true, items };
}

/** The post's headline price: the cheapest card, shown as "from ฿X". */
export function cheapestPrice(items: { price: number }[]): number {
  return items.reduce((min, i) => Math.min(min, i.price), Infinity);
}

export function totalPrice(items: { price: number }[]): number {
  return items.reduce((sum, i) => sum + i.price, 0);
}

/**
 * CSS for a square thumbnail zoomed in on one card, cut out of the big photo (no extra
 * upload needed). The photo is drawn `zoom` times the box's width, shifted so the
 * circle's centre lands in the middle of the box.
 */
export function cropStyle(item: { x: number; y: number; r: number }, aspect: number) {
  const zoom = 100 / (2 * item.r); // the circle's diameter fills the box
  return {
    position: "absolute" as const,
    maxWidth: "none",
    width: `${zoom * 100}%`,
    left: `${(0.5 - (item.x / 100) * zoom) * 100}%`,
    top: `${(0.5 - (item.y / 100) * zoom * aspect) * 100}%`,
  };
}
