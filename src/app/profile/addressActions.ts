"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/session";
import { getAddress, listAddresses } from "@/lib/addressBook";
import { MAX_ADDRESSES, cleanAddressInput } from "@/lib/addresses";

function refresh(userId: string) {
  revalidatePath("/profile");
  revalidatePath(`/profile/${userId}`);
}

const FAILED = "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง" as const;

// Every action takes the user from the verified session and filters every query
// by it; ids from the client are only ever matched together with user_id.

export async function saveAddress(input: unknown, id?: string) {
  const userId = await getSessionUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };
  const cleaned = cleanAddressInput(input);
  if (!cleaned.ok) return { error: cleaned.error };

  try {
    const supabase = createServiceClient();
    if (id) {
      if (!(await getAddress(userId, id))) return { error: "ไม่พบที่อยู่นี้" as const };
      const { error } = await supabase
        .from("profile_addresses")
        .update({ ...cleaned.value, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
    } else {
      const existing = await listAddresses(userId);
      if (existing.length >= MAX_ADDRESSES) return { error: `บันทึกได้สูงสุด ${MAX_ADDRESSES} ที่อยู่` as const };
      const { error } = await supabase
        .from("profile_addresses")
        .insert({ ...cleaned.value, user_id: userId, is_default: existing.length === 0 });
      if (error) throw error;
    }
  } catch (e) {
    console.error("[address] save failed", (e as { code?: string }).code);
    return { error: FAILED };
  }
  refresh(userId);
  return { success: true as const };
}

export async function setDefaultAddress(id: string) {
  const userId = await getSessionUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };
  try {
    if (!(await getAddress(userId, id))) return { error: "ไม่พบที่อยู่นี้" as const };
    const supabase = createServiceClient();
    // Clear first: a partial unique index allows only one default per person.
    const cleared = await supabase.from("profile_addresses").update({ is_default: false }).eq("user_id", userId).eq("is_default", true);
    if (cleared.error) throw cleared.error;
    const set = await supabase.from("profile_addresses").update({ is_default: true }).eq("id", id).eq("user_id", userId);
    if (set.error) throw set.error;
  } catch (e) {
    console.error("[address] set default failed", (e as { code?: string }).code);
    return { error: FAILED };
  }
  refresh(userId);
  return { success: true as const };
}

export async function deleteAddress(id: string) {
  const userId = await getSessionUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };
  try {
    const target = await getAddress(userId, id);
    if (!target) return { error: "ไม่พบที่อยู่นี้" as const };
    const supabase = createServiceClient();
    const removed = await supabase.from("profile_addresses").delete().eq("id", id).eq("user_id", userId);
    if (removed.error) throw removed.error;
    if (target.is_default) {
      // Keep a default whenever any address remains.
      const [next] = await listAddresses(userId);
      if (next) {
        const promoted = await supabase.from("profile_addresses").update({ is_default: true }).eq("id", next.id).eq("user_id", userId);
        if (promoted.error) throw promoted.error;
      }
    }
  } catch (e) {
    console.error("[address] delete failed", (e as { code?: string }).code);
    return { error: FAILED };
  }
  refresh(userId);
  return { success: true as const };
}
