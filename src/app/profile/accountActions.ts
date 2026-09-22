"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient, createServiceClient } from "@/lib/supabase/server";
import { logAuthError } from "@/lib/authLog";
import { AVATAR_STORAGE_PATH_PREFIX, avatarFromIdentity, trustedAvatarUrl } from "@/lib/avatar";

const IDENTITY_PROVIDER = { line: "custom:line", google: "google" } as const;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// Identifies the real image format from its bytes. Never trust the client's
// declared MIME type or filename: Storage would otherwise serve back whatever
// content-type an attacker claims, on our own domain.
function sniffImageType(bytes: Uint8Array): { contentType: string; ext: string } | null {
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { contentType: "image/png", ext: "png" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { contentType: "image/jpeg", ext: "jpg" };
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { contentType: "image/webp", ext: "webp" };
  }
  return null;
}

// The storage path of a previous upload, only if it is both in our avatars
// bucket and under this user's own folder — never something to delete on the
// strength of a URL alone.
function ownedUploadPath(avatarUrl: string | null | undefined, userId: string): string | null {
  if (!avatarUrl) return null;
  let url: URL;
  try {
    url = new URL(avatarUrl);
  } catch {
    return null;
  }
  if (!url.pathname.startsWith(AVATAR_STORAGE_PATH_PREFIX)) return null;
  const path = decodeURIComponent(url.pathname.slice(AVATAR_STORAGE_PATH_PREFIX.length));
  return path.startsWith(`${userId}/`) ? path : null;
}

// Uploads a profile picture from the user's own device. The file is sniffed
// from its bytes (never the client's claimed type), stored under the user's
// own folder, and the resulting URL still has to pass the same trusted-host
// check as any other avatar before it is saved.
export async function uploadAvatar(formData: FormData): Promise<{ success: true } | { error: string }> {
  try {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "กรุณาเข้าสู่ระบบก่อน" };

    const file = formData.get("avatar");
    if (!(file instanceof File) || file.size === 0) return { error: "กรุณาเลือกรูปภาพ" };
    if (file.size > MAX_AVATAR_BYTES) return { error: "ไฟล์ใหญ่เกินไป (ไม่เกิน 5 MB)" };

    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffImageType(bytes);
    if (!sniffed) return { error: "รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP" };

    const service = createServiceClient();
    const path = `${user.id}/${crypto.randomUUID()}.${sniffed.ext}`;
    const { error: uploadError } = await service.storage.from("avatars").upload(path, bytes, { contentType: sniffed.contentType, upsert: false });
    if (uploadError) {
      console.error("[profile] avatar upload failed", uploadError.message);
      // Distinguish "not set up yet" (run migration 0011) from a normal, retryable failure.
      if (/bucket/i.test(uploadError.message)) return { error: "ระบบอัปโหลดรูปยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล" };
      return { error: "อัปโหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง" };
    }

    const avatarUrl = trustedAvatarUrl(service.storage.from("avatars").getPublicUrl(path).data.publicUrl);
    if (!avatarUrl) {
      // Unreachable in practice: our own bucket URL must satisfy our own rule.
      await service.storage.from("avatars").remove([path]);
      return { error: "อัปโหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง" };
    }

    const { data: previous } = await service.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();
    const { error: updateError } = await service.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);
    if (updateError) {
      console.error("[profile] save uploaded avatar failed", updateError.code);
      await service.storage.from("avatars").remove([path]);
      return { error: "บันทึกรูปโปรไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง" };
    }

    // Best-effort: never let cleanup of the old file affect the result.
    const previousPath = ownedUploadPath(previous?.avatar_url, user.id);
    if (previousPath) await service.storage.from("avatars").remove([previousPath]);

    revalidatePath("/profile");
    revalidatePath(`/profile/${user.id}`);
    return { success: true };
  } catch (e) {
    logAuthError("upload avatar exception", e);
    return { error: "อัปโหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}

// Sets the profile picture to the photo one of the user's own linked sign-in
// identities offers. The identity and its photo are both read from the Auth
// server for the signed-in user, never taken from the client.
export async function setAvatarFromProvider(provider: keyof typeof IDENTITY_PROVIDER): Promise<{ success: true } | { error: string }> {
  try {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "กรุณาเข้าสู่ระบบก่อน" };

    const identity = user.identities?.find((i) => i.provider === IDENTITY_PROVIDER[provider]);
    const avatarUrl = avatarFromIdentity(identity);
    if (!avatarUrl) return { error: "ไม่พบรูปโปรไฟล์จากช่องทางนี้" };

    const { error } = await createServiceClient().from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);
    if (error) {
      console.error("[profile] set avatar failed", error.code);
      return { error: "บันทึกรูปโปรไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง" };
    }

    revalidatePath("/profile");
    revalidatePath(`/profile/${user.id}`);
    return { success: true };
  } catch (e) {
    logAuthError("set avatar from provider exception", e);
    return { error: "บันทึกรูปโปรไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}

// Removes the Google backup sign-in from the signed-in user's own account. The
// identity is read from the Auth server, never taken from the client, and another
// sign-in method must remain so the account cannot be locked out.
export async function unlinkGoogle(): Promise<{ success: true } | { error: string }> {
  try {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "กรุณาเข้าสู่ระบบก่อน" };

    const identities = user.identities ?? [];
    const google = identities.find((identity) => identity.provider === "google");
    if (!google) return { error: "บัญชีนี้ยังไม่ได้เชื่อม Google" };
    if (identities.length < 2) return { error: "ต้องมีช่องทางเข้าสู่ระบบอย่างน้อย 1 ช่องทาง จึงยกเลิกการเชื่อม Google ไม่ได้" };

    const { error } = await supabase.auth.unlinkIdentity(google);
    if (error) {
      logAuthError("unlink Google", error);
      return { error: "ยกเลิกการเชื่อม Google ไม่สำเร็จ กรุณาลองอีกครั้ง" };
    }
    revalidatePath("/profile");
    revalidatePath(`/profile/${user.id}`);
    return { success: true };
  } catch (e) {
    logAuthError("unlink Google exception", e);
    return { error: "ยกเลิกการเชื่อม Google ไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}
