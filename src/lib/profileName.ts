export const DEFAULT_DISPLAY_NAME = "นักสะสม";
export const DELETED_DISPLAY_NAME = "ผู้ใช้ที่ถูกลบ";
export const NAME_MIN = 2;
export const NAME_MAX = 30;
export const BIO_MAX = 200;

// Control, zero-width and bidi-override characters let one account imitate
// another's name or hide text, so they are never stored.
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
const length = (text: string) => Array.from(text).length;

/** Returns the cleaned name, or null when it is unusable. */
export function cleanDisplayName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = input.normalize("NFC").replace(/\s+/g, " ").replace(INVISIBLE, "").replace(/ +/g, " ").trim();
  return length(name) >= NAME_MIN && length(name) <= NAME_MAX ? name : null;
}

/** Returns the cleaned bio (may be empty), or null when it is too long or not text. */
export function cleanBio(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const bio = input
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, (c) => (c === "\n" ? c : ""))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return length(bio) <= BIO_MAX ? bio : null;
}

// Thai leading vowels sit before the consonant, so "เก็บ" would show as "เ".
const THAI_LEADING_VOWELS = "เแโใไ";

export function avatarInitial(name: string): string {
  const chars = Array.from(name);
  const index = chars.length > 1 && THAI_LEADING_VOWELS.includes(chars[0]) ? 1 : 0;
  return (chars[index] ?? "T").toUpperCase();
}
