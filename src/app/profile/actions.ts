"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/session";
import { BIO_MAX, NAME_MAX, NAME_MIN, avatarInitial, cleanBio, cleanDisplayName } from "@/lib/profileName";

// Only these three columns are ever written; verified, bank_name_matched,
// is_admin and tier can never be changed from here.
export async function updateProfile(displayName: string, bio: string) {
  const userId = await getSessionUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };

  const name = cleanDisplayName(displayName);
  if (!name) return { error: `ชื่อที่แสดงต้องยาว ${NAME_MIN}–${NAME_MAX} ตัวอักษร` as const };
  const cleanedBio = cleanBio(bio);
  if (cleanedBio === null) return { error: `แนะนำตัวต้องไม่เกิน ${BIO_MAX} ตัวอักษร` as const };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name, avatar_initial: avatarInitial(name), bio: cleanedBio })
    .eq("id", userId);
  if (error) {
    console.error("profile update failed", error.code);
    return { error: "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง" as const };
  }

  revalidatePath("/profile");
  revalidatePath(`/profile/${userId}`);
  return { success: true as const };
}
