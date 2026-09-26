import type { ListingCategory } from "@/lib/supabase/types";

/**
 * Cardfight!! Vanguard listing vocabulary. Kept in one place so the create form,
 * the edit form, the API routes and the listing page all agree. Edit the list
 * below to add or rename rarities; nothing else needs to change.
 */
export const VANGUARD_RARITIES = ["C", "R", "RR", "RRR", "SP", "SVR", "SCR", "SEC", "OR", "PR", "TD"] as const;
export const OTHER_RARITY = "อื่น ๆ";

/** DB values stay `new` / `deck` / `rare`; these are the labels sellers see. */
export const PRODUCT_TYPE_LABELS: Record<ListingCategory, string> = {
  rare: "การ์ดแยกใบ / เป็นชุด",
  deck: "เด็คพร้อมเล่น",
  new: "กล่องบูสเตอร์ / ซีล",
};

export const MAX_SINGLES_QUANTITY = 4;
export const MAX_QUANTITY = 99;

export type ListingDetails =
  | { ok: true; rarity: string; quantity: number; hasExtras: boolean | null }
  | { ok: false; error: string };

/** Validates the type-specific fields and derives the stored rarity. */
export function parseListingDetails(
  category: string,
  raw: { rarity?: string; quantity?: string; hasExtras?: string }
): ListingDetails {
  const quantityRaw = (raw.quantity ?? "").trim();
  const quantity = quantityRaw ? Number(quantityRaw) : 1;

  if (category === "rare") {
    const rarity = (raw.rarity ?? "").trim();
    const known = (VANGUARD_RARITIES as readonly string[]).includes(rarity) || rarity === OTHER_RARITY;
    if (!known) return { ok: false, error: "เลือกความหายากของการ์ด" };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_SINGLES_QUANTITY) {
      return { ok: false, error: `จำนวนการ์ดต้องอยู่ระหว่าง 1 – ${MAX_SINGLES_QUANTITY} ใบ` };
    }
    return { ok: true, rarity, quantity, hasExtras: null };
  }

  if (category === "deck") {
    const extras = (raw.hasExtras ?? "").trim();
    if (extras !== "true" && extras !== "false") return { ok: false, error: "ระบุว่าเด็คมีอะไหล่หรือไม่" };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return { ok: false, error: "จำนวนไม่ถูกต้อง" };
    }
    return { ok: true, rarity: "DECK", quantity, hasExtras: extras === "true" };
  }

  if (category === "new") {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return { ok: false, error: "จำนวนไม่ถูกต้อง" };
    }
    return { ok: true, rarity: "BOX", quantity, hasExtras: null };
  }

  return { ok: false, error: "เลือกประเภทสินค้า" };
}

/** "เป็นชุด 4 ใบ" / "2 กล่อง" / "" — for the listing page. */
export function describeQuantity(category: ListingCategory, quantity: number): string {
  if (category === "rare") return quantity > 1 ? `เป็นชุด ${quantity} ใบ` : "1 ใบ";
  if (category === "new") return `${quantity} กล่อง`;
  return quantity > 1 ? `${quantity} เด็ค` : "";
}
