/**
 * Order videos (the seller's packing video and the buyer's unboxing video) are
 * evidence in disputes and are served from a public storage bucket. Like avatars,
 * the file type is decided from the bytes, never from the client-supplied
 * type or filename, so nothing but a real MP4/MOV can be stored there.
 */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export interface VideoType {
  ext: "mp4" | "mov";
  contentType: "video/mp4" | "video/quicktime";
}

const MP4: VideoType = { ext: "mp4", contentType: "video/mp4" };
const MOV: VideoType = { ext: "mov", contentType: "video/quicktime" };

// QuickTime files may open with one of these atoms instead of `ftyp`.
const QUICKTIME_ATOMS = ["moov", "mdat", "free", "skip", "wide"];

const ascii = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));

export function sniffVideoType(bytes: Uint8Array): VideoType | null {
  if (bytes.length < 12) return null;
  const atom = ascii(bytes, 4, 8);
  if (atom === "ftyp") return ascii(bytes, 8, 12) === "qt  " ? MOV : MP4;
  if (QUICKTIME_ATOMS.includes(atom)) return MOV;
  return null;
}

export type VideoCheck = { ok: true; type: VideoType; bytes: ArrayBuffer } | { ok: false; error: string };

/** Validates an uploaded form file: size first (cheap), then the real type. */
export async function checkVideoFile(file: File): Promise<VideoCheck> {
  if (file.size === 0) return { ok: false, error: "ไฟล์วิดีโอว่างเปล่า" };
  if (file.size > MAX_VIDEO_BYTES) {
    return { ok: false, error: `ไฟล์ใหญ่เกินไป (สูงสุด ${MAX_VIDEO_BYTES / 1024 / 1024} MB)` };
  }
  const bytes = await file.arrayBuffer();
  const type = sniffVideoType(new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 16)));
  if (!type) return { ok: false, error: "รองรับเฉพาะวิดีโอ MP4 หรือ MOV" };
  return { ok: true, type, bytes };
}
