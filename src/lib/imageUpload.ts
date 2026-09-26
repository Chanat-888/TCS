/**
 * Card photos are served from a public storage bucket, so like avatars and order
 * videos their type is decided from the file's own bytes, never from the
 * client-supplied type or filename (an "image/*" SVG or HTML file would otherwise be
 * served from our storage domain). The browser also shrinks photos before upload
 * (src/lib/clientImage.ts), so a normal photo is far below this limit.
 */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

export interface ImageType {
  ext: "jpg" | "png" | "webp" | "gif";
  contentType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

const ascii = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));

export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", contentType: "image/jpeg" };
  if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === "PNG") return { ext: "png", contentType: "image/png" };
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return { ext: "webp", contentType: "image/webp" };
  const gif = ascii(bytes, 0, 6);
  if (gif === "GIF87a" || gif === "GIF89a") return { ext: "gif", contentType: "image/gif" };
  return null;
}

export type PhotoCheck = { ok: true; type: ImageType; bytes: ArrayBuffer } | { ok: false; error: string };

/** Validates an uploaded card photo: size first (cheap), then the real type. */
export async function checkPhotoFile(file: File, label: string): Promise<PhotoCheck> {
  if (file.size === 0) return { ok: false, error: `รูป${label}ว่างเปล่า` };
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: `รูป${label}ใหญ่เกินไป (สูงสุด ${MAX_PHOTO_BYTES / 1024 / 1024} MB) ลองเลือกรูปใหม่` };
  }
  const bytes = await file.arrayBuffer();
  const type = sniffImageType(new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 16)));
  if (!type) return { ok: false, error: `รูป${label}ต้องเป็นไฟล์ JPG, PNG, WebP หรือ GIF` };
  return { ok: true, type, bytes };
}
