// Omise bank codes for Thai banks. ponytail: verify this list against Omise's
// supported banks before launch; a wrong code is rejected by Omise when saving.
export const BANKS: Record<string, string> = {
  kbank: "กสิกรไทย",
  scb: "ไทยพาณิชย์",
  bbl: "กรุงเทพ",
  ktb: "กรุงไทย",
  bay: "กรุงศรีอยุธยา",
  ttb: "ทหารไทยธนชาต",
  gsb: "ออมสิน",
  cimb: "ซีไอเอ็มบี ไทย",
  uob: "ยูโอบี",
  kk: "เกียรตินาคินภัทร",
  lhb: "แลนด์ แอนด์ เฮ้าส์",
  tisco: "ทิสโก้",
  ghb: "อาคารสงเคราะห์",
  baac: "ธ.ก.ส.",
};

export function cleanBankAccount(input: unknown):
  | { ok: true; value: { brand: string; number: string; name: string } }
  | { ok: false; error: string } {
  const i = (input ?? {}) as Record<string, unknown>;
  const brand = typeof i.brand === "string" ? i.brand : "";
  const number = typeof i.number === "string" ? i.number.replace(/[\s-]/g, "") : "";
  const name = typeof i.name === "string" ? i.name.trim() : "";
  if (!(brand in BANKS)) return { ok: false, error: "เลือกธนาคาร" };
  if (!/^[0-9]{10,15}$/.test(number)) return { ok: false, error: "เลขบัญชีต้องเป็นตัวเลข 10–15 หลัก" };
  if (name.length < 2 || name.length > 60) return { ok: false, error: "กรอกชื่อบัญชีให้ตรงกับสมุดบัญชี" };
  return { ok: true, value: { brand, number, name } };
}
