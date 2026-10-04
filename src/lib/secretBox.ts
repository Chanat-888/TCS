import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for bank account numbers. BANK_ENCRYPTION_KEY is 32 random bytes as base64
// (`openssl rand -base64 32`). Losing the key makes saved numbers unreadable, so back it up.
function key() {
  const k = Buffer.from(process.env.BANK_ENCRYPTION_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("BANK_ENCRYPTION_KEY must be 32 bytes, base64");
  return k;
}

export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

export function decrypt(blob: string): string {
  const b = Buffer.from(blob, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  decipher.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([decipher.update(b.subarray(28)), decipher.final()]).toString("utf8");
}
