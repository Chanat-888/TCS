"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/session";
import { isAdmin } from "@/lib/admin";

// Admin pays by hand from the bank app, then records the result here. The database
// accepts each request once, so a double click or a second admin cannot finish it twice.
export async function finishWithdrawal(id: string, paid: boolean, reference: string) {
  if (!(await isAdmin(await getSessionUserId()))) return { error: "ไม่มีสิทธิ์เข้าถึง" as const };
  const { error } = await createServiceClient().rpc("finish_withdrawal", { p_id: id, p_paid: paid, p_ref: reference });
  if (error) {
    if (error.message.includes("not_requested")) return { error: "คำขอนี้ถูกบันทึกผลไปแล้ว" as const };
    console.error("[withdrawal] finish failed", error.message);
    return { error: "บันทึกผลไม่สำเร็จ ลองอีกครั้ง" as const };
  }
  revalidatePath("/admin/withdrawals");
  return { success: true as const };
}
