// PromptPay QR payload (EMVCo merchant-presented, dynamic: the amount is built in so the
// buyer cannot change it). No gateway and no fee; money goes straight to the PromptPay ID.

const field = (tag: string, value: string) => tag + String(value.length).padStart(2, "0") + value;

/** CRC-16/CCITT-FALSE, upper-case hex: the checksum that ends every EMVCo QR payload. */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (const char of text) {
    crc ^= char.charCodeAt(0) << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** `id` is a 10-digit mobile number or a 13-digit tax / national ID. Null when `id` or the amount is not usable. */
export function promptPayPayload(id: string, amountBaht: number): string | null {
  const digits = id.replace(/\D/g, "");
  let target: string;
  if (/^0\d{9}$/.test(digits)) target = field("01", "0066" + digits.slice(1));
  else if (/^\d{13}$/.test(digits)) target = field("02", digits);
  else return null;
  if (!Number.isFinite(amountBaht) || amountBaht <= 0) return null;

  const body =
    field("00", "01") +
    field("01", "12") +
    field("29", field("00", "A000000677010111") + target) +
    field("53", "764") +
    field("54", amountBaht.toFixed(2)) +
    field("58", "TH") +
    "6304";
  return body + crc16(body);
}
