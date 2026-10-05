"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/session";
import { isAdmin } from "@/lib/admin";

// The admin looked at the selfie and the card, typed the legal name from the card and decides.
// The database records the decision once and hands back the image paths; the files are deleted
// here right after (a failed delete is logged with the paths so they can be removed by hand).
export async function decideIdentity(userId: string, approve: boolean, legalName: string, reason: string) {
  const adminId = await getSessionUserId();
  if (!(await isAdmin(adminId))) return { error: "ไม่มีสิทธิ์เข้าถึง" as const };
  const supabase = createServiceClient();
  const { data: paths, error } = await supabase.rpc("decide_identity", {
    p_user: userId,
    p_approve: approve,
    p_name: legalName,
    p_reason: reason,
    p_admin: adminId,
  });
  if (error) {
    if (error.message.includes("name_required")) return { error: "ใส่ชื่อ-นามสกุลตามบัตรก่อนอนุมัติ" as const };
    if (error.message.includes("not_submitted")) return { error: "คำขอนี้ตัดสินไปแล้ว" as const };
    console.error("[identity] decide failed", error.message);
    return { error: "บันทึกผลไม่สำเร็จ ลองอีกครั้ง" as const };
  }
  if (paths?.length) {
    const { error: removeError } = await supabase.storage.from("id-checks").remove(paths);
    if (removeError) console.error("[identity] could not delete ID images, remove by hand:", paths.join(", "), removeError.message);
  }
  revalidatePath("/admin/sellers");
  return { success: true as const };
}

// Our own bank app showed the account holder name for the saved number and it matches the legal name.
export async function confirmAccountName(userId: string) {
  if (!(await isAdmin(await getSessionUserId()))) return { error: "ไม่มีสิทธิ์เข้าถึง" as const };
  const { error } = await createServiceClient().rpc("confirm_account_name", { p_user: userId });
  if (error) {
    if (error.message.includes("not_ready")) return { error: "ผู้ขายยังไม่พร้อม (ต้องผ่านการยืนยันตัวตนและมีบัญชีรับเงิน)" as const };
    console.error("[identity] confirm account name failed", error.message);
    return { error: "บันทึกไม่สำเร็จ ลองอีกครั้ง" as const };
  }
  revalidatePath("/admin/sellers");
  return { success: true as const };
}
