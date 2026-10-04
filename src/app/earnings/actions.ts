"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/session";
import { MIN_WITHDRAWAL_BAHT } from "@/lib/money";

// The browser only says how much; the database checks the balance, works out the fee and
// deducts in one transaction (request_withdrawal in migration 0025).
export async function requestWithdrawal(amountBaht: number) {
  const userId = await getSessionUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };
  if (!Number.isInteger(amountBaht) || amountBaht < MIN_WITHDRAWAL_BAHT) {
    return { error: `ถอนขั้นต่ำ ฿${MIN_WITHDRAWAL_BAHT} (ใส่เป็นจำนวนเต็ม)` as const };
  }
  const { error } = await createServiceClient().rpc("request_withdrawal", { p_seller: userId, p_amount: amountBaht * 100 });
  if (error) {
    if (error.message.includes("insufficient_balance")) return { error: "ยอดที่ถอนได้ไม่พอ" as const };
    if (error.message.includes("no_bank_account")) return { error: "เพิ่มบัญชีรับเงินที่หน้าโปรไฟล์ก่อน" as const };
    console.error("[withdrawal] request failed", error.message);
    return { error: "ส่งคำขอถอนไม่สำเร็จ ลองอีกครั้ง" as const };
  }
  revalidatePath("/earnings");
  return { success: true as const };
}
