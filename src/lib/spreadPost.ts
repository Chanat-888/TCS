import { OTHER_RARITY, VANGUARD_RARITIES } from "@/lib/vanguard";

/**
 * Rules for "spread" posts: a photo (or a few) of many cards laid out, each card a
 * separately purchasable item the buyer picks by the number written next to it.
 */
export const MAX_SPREAD_ITEMS = 30;
export const MAX_ITEM_NUMBER = 60;
// Three photos keeps the whole upload under the ~4.5 MB request cap of our hosting.
export const MAX_SPREAD_PHOTOS = 3;
export const MAX_SPREAD_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_ITEM_PRICE = 1_000_000;
export const SPREAD_POST_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export interface SpreadItemInput {
  position: number;
  name: string;
  rarity: string;
  condition: string;
  price: number;
}

export type ParsedItems = { ok: true; items: SpreadItemInput[] } | { ok: false; error: string };

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);

/** Validates the seller's card list. Numbers must be unique, so a buyer's "#3" is unambiguous. */
export function parseSpreadItems(raw: unknown): ParsedItems {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "เพิ่มการ์ดอย่างน้อย 1 ใบ" };
  if (raw.length > MAX_SPREAD_ITEMS) return { ok: false, error: `ใส่การ์ดได้สูงสุด ${MAX_SPREAD_ITEMS} ใบต่อโพสต์` };

  const items: SpreadItemInput[] = [];
  const seen = new Set<number>();
  for (const [index, entry] of raw.entries()) {
    const label = `การ์ดแถวที่ ${index + 1}`;
    const e = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const position = num(e.position);
    const name = typeof e.name === "string" ? e.name.trim() : "";
    const rarity = typeof e.rarity === "string" ? e.rarity.trim() : "";
    const condition = typeof e.condition === "string" ? e.condition.trim() : "";
    const price = num(e.price);

    if (!Number.isInteger(position) || position < 1 || position > MAX_ITEM_NUMBER) {
      return { ok: false, error: `${label}: หมายเลขต้องเป็น 1 – ${MAX_ITEM_NUMBER}` };
    }
    if (seen.has(position)) return { ok: false, error: `${label}: หมายเลข ${position} ซ้ำกัน` };
    seen.add(position);
    if (!name || name.length > 80) return { ok: false, error: `${label}: กรอกชื่อการ์ด (ไม่เกิน 80 ตัวอักษร)` };
    const knownRarity = (VANGUARD_RARITIES as readonly string[]).includes(rarity) || rarity === OTHER_RARITY;
    if (!knownRarity) return { ok: false, error: `${label}: เลือกความหายาก` };
    if (!condition || condition.length > 60) return { ok: false, error: `${label}: เลือกสภาพการ์ด` };
    if (!Number.isInteger(price) || price < 1 || price > MAX_ITEM_PRICE) {
      return { ok: false, error: `${label}: ราคาต้องเป็นจำนวนเต็ม ฿1 – ฿${MAX_ITEM_PRICE.toLocaleString("en-US")}` };
    }
    items.push({ position, name, rarity, condition, price });
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
