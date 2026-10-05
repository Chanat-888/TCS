import type { createServiceClient } from "@/lib/supabase/server";
import type { PhotoCheck } from "@/lib/imageUpload";

type Supabase = ReturnType<typeof createServiceClient>;

/** The photo field of a form, if the poster picked one (an empty file input sends a zero-byte File). */
export function pickedPhoto(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 ? value : null;
}

/**
 * Stores a photo that already passed checkPhotoFile (size and real type, from its bytes) in the public
 * listing-photos bucket under wanted/<post id>/, returning its public URL.
 */
export async function storeWantedPhoto(
  supabase: Supabase,
  postId: string,
  checked: Extract<PhotoCheck, { ok: true }>
): Promise<{ ok: true; url: string } | { ok: false; error: string; status: number }> {
  const path = `wanted/${postId}/photo-${crypto.randomUUID()}.${checked.type.ext}`;
  const { error } = await supabase.storage.from("listing-photos").upload(path, checked.bytes, { contentType: checked.type.contentType });
  if (error) return { ok: false, error: "อัปโหลดรูปไม่สำเร็จ ลองอีกครั้ง", status: 500 };
  return { ok: true, url: supabase.storage.from("listing-photos").getPublicUrl(path).data.publicUrl };
}
