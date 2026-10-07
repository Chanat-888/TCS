import { crc16 } from "@/lib/promptpay";

// Every Thai transfer slip carries a small QR (the "slip verify" QR). Its text is EMVCo-style fields: field 00
// holds sub-fields (01 = sending bank code, 02 = transaction reference), then 51 = country and 91 = checksum.
// Reading it is free and runs on our side; it does NOT prove the slip is real (only the bank can say so).

// Bank codes (Bank of Thailand numbering) mapped to the keys of BANKS in src/lib/bankAccount.ts.
// ponytail: from memory, check against real slips from each bank before relying on a bank name.
const BANK_BY_CODE: Record<string, string> = {
  "002": "bbl", "004": "kbank", "006": "ktb", "011": "ttb", "014": "scb", "022": "cimb", "024": "uob",
  "025": "bay", "030": "gsb", "033": "ghb", "034": "baac", "067": "tisco", "069": "kk", "073": "lhb",
};

function fields(text: string): [string, string][] | null {
  const out: [string, string][] = [];
  for (let i = 0; i < text.length; ) {
    const len = Number(text.slice(i + 2, i + 4));
    if (!Number.isInteger(len) || text.length < i + 4 + len) return null;
    out.push([text.slice(i, i + 2), text.slice(i + 4, i + 4 + len)]);
    i += 4 + len;
  }
  return out;
}

/** The transaction reference and sending bank from a slip QR text, or null when it is not a slip QR (or its checksum is wrong). */
export function parseSlipQr(text: unknown): { ref: string; bank: string | null } | null {
  if (typeof text !== "string" || text.length < 20 || text.length > 300) return null;
  const top = fields(text);
  const crc = top?.find(([tag]) => tag === "91")?.[1];
  if (!top || !crc || crc !== crc16(text.slice(0, -4))) return null;
  const inner = fields(top.find(([tag]) => tag === "00")?.[1] ?? "");
  const ref = inner?.find(([tag]) => tag === "02")?.[1];
  if (!ref || !/^[A-Za-z0-9]{10,40}$/.test(ref)) return null;
  const code = inner?.find(([tag]) => tag === "01")?.[1] ?? "";
  return { ref, bank: BANK_BY_CODE[code] ?? null };
}
