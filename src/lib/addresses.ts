import { THAI_PROVINCES } from "@/lib/thaiProvinces";

export const MAX_ADDRESSES = 5;

/** A saved address as the owner sees it. Never sent to anyone else. */
export interface SavedAddress {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  address: string;
  province: string;
  postcode: string;
  is_default: boolean;
}

export interface AddressFields {
  recipient: string;
  phone: string;
  address: string;
  province: string;
  postcode: string;
}

export interface AddressInput extends AddressFields {
  label: string;
}

export type CleanResult<T> = { ok: true; value: T } | { ok: false; error: string };

// Same reasoning as display names: control, zero-width and bidi characters let
// text hide or impersonate, so they never reach the database or a seller's screen.
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
const length = (text: string) => Array.from(text).length;

function cleanLine(input: unknown, min: number, max: number): string | null {
  if (typeof input !== "string") return null;
  const text = input.normalize("NFC").replace(/\s+/g, " ").replace(INVISIBLE, "").replace(/ +/g, " ").trim();
  return length(text) >= min && length(text) <= max ? text : null;
}

/** Thai phone numbers, mobile or landline, as 9-10 digits starting with 0. */
export function cleanContactPhone(input: unknown): string | null {
  if (typeof input !== "string" || !/^[+\d\s()-]+$/.test(input)) return null;
  let digits = input.replace(/[\s()-]/g, "");
  if (digits.startsWith("+66")) digits = "0" + digits.slice(3);
  else if (digits.startsWith("66") && digits.length >= 11) digits = "0" + digits.slice(2);
  return /^0\d{8,9}$/.test(digits) ? digits : null;
}

export function cleanAddressFields(input: unknown): CleanResult<AddressFields> {
  const raw = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const recipient = cleanLine(raw.recipient, 2, 60);
  if (!recipient) return { ok: false, error: "กรอกชื่อผู้รับ 2–60 ตัวอักษร" };
  const phone = cleanContactPhone(raw.phone);
  if (!phone) return { ok: false, error: "กรอกเบอร์โทรศัพท์ให้ถูกต้อง เช่น 081 234 5678" };
  const address = cleanLine(raw.address, 5, 300);
  if (!address) return { ok: false, error: "กรอกที่อยู่ 5–300 ตัวอักษร (บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ)" };
  const province = cleanLine(raw.province, 2, 40);
  if (!province || !(THAI_PROVINCES as readonly string[]).includes(province)) return { ok: false, error: "เลือกจังหวัดจากรายการ" };
  const postcode = typeof raw.postcode === "string" ? raw.postcode.trim() : "";
  if (!/^\d{5}$/.test(postcode)) return { ok: false, error: "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก" };
  return { ok: true, value: { recipient, phone, address, province, postcode } };
}

export function cleanAddressInput(input: unknown): CleanResult<AddressInput> {
  const fields = cleanAddressFields(input);
  if (!fields.ok) return fields;
  const raw = input as Record<string, unknown>;
  const label = cleanLine(raw.label, 1, 20);
  if (!label) return { ok: false, error: "ตั้งชื่อที่อยู่ 1–20 ตัวอักษร เช่น บ้าน หรือ ที่ทำงาน" };
  return { ok: true, value: { label, ...fields.value } };
}
