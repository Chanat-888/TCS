import type { ListingCategory } from "@/lib/supabase/types";

const CATEGORIES: ListingCategory[] = ["new", "deck", "rare"];
export const MAX_WANTED_TEXT = 120;
export const MAX_WANTED_NOTE = 400;
export const MAX_WANTED_BUDGET = 10_000_000;

export type WantedFields = { name: string; set_name: string; category: ListingCategory; max_price: number; note: string };

/** Reads and checks the "looking for" form (create and edit share it). */
export function parseWantedFields(get: (key: string) => FormDataEntryValue | null): { ok: true; fields: WantedFields } | { ok: false; error: string } {
  const name = String(get("name") ?? "").trim();
  const setName = String(get("set") ?? "").trim();
  const category = String(get("category") ?? "") as ListingCategory;
  const maxPrice = parseInt(String(get("maxPrice") ?? ""), 10);
  const note = String(get("note") ?? "").trim();
  if (!name || !setName) return { ok: false, error: "กรอกชื่อการ์ดและชุดให้ครบ" };
  if (name.length > MAX_WANTED_TEXT || setName.length > MAX_WANTED_TEXT) return { ok: false, error: `ชื่อและชุดยาวได้ไม่เกิน ${MAX_WANTED_TEXT} ตัวอักษร` };
  if (!CATEGORIES.includes(category)) return { ok: false, error: "เลือกหมวดหมู่" };
  if (!Number.isInteger(maxPrice) || maxPrice < 1 || maxPrice > MAX_WANTED_BUDGET) return { ok: false, error: "กรอกงบสูงสุดให้ถูกต้อง" };
  if (note.length > MAX_WANTED_NOTE) return { ok: false, error: `รายละเอียดยาวได้ไม่เกิน ${MAX_WANTED_NOTE} ตัวอักษร` };
  return { ok: true, fields: { name, set_name: setName, category, max_price: maxPrice, note } };
}
