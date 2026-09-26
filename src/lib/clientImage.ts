import { loadImage } from "@/lib/loadImage";

/** Browser-side card photo preparation. Runs in the seller's browser before upload. */
const MAX_ORIGINAL_BYTES = 40 * 1024 * 1024;
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;

export type PreparedPhoto = { ok: true; file: File; width: number; height: number } | { ok: false; error: string };

/**
 * Turns whatever the seller picked (a huge phone photo, a PNG, an animated GIF)
 * into a normal JPEG of at most 1600px on its longest side. That keeps uploads small
 * and fast, uses a GIF's first frame, and drops any animation or odd file structure.
 */
export async function prepareCardPhoto(
  file: File,
  { maxSide = MAX_SIDE, quality = JPEG_QUALITY }: { maxSide?: number; quality?: number } = {}
): Promise<PreparedPhoto> {
  if (!file.type.startsWith("image/")) return { ok: false, error: "เลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WebP หรือ GIF)" };
  if (file.size > MAX_ORIGINAL_BYTES) return { ok: false, error: "ไฟล์ใหญ่เกินไป (เกิน 40 MB) ลองเลือกรูปอื่น" };

  try {
    const bitmap = await loadImage(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return { ok: false, error: "เบราว์เซอร์นี้ประมวลผลรูปไม่ได้ ลองเบราว์เซอร์อื่น" };
    // JPEG has no transparency: paint white first so a transparent PNG doesn't turn black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap.source, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return { ok: false, error: "ประมวลผลรูปไม่สำเร็จ ลองเลือกรูปอื่น" };
    return { ok: true, file: new File([blob], "card.jpg", { type: "image/jpeg" }), width, height };
  } catch {
    return { ok: false, error: "เปิดรูปนี้ไม่ได้ ไฟล์อาจเสียหาย ลองเลือกรูปอื่น" };
  }
}
