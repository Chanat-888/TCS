"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/session";
import { isAdmin } from "@/lib/admin";

// The browser only sends what the admin read off the bank app; the owed total is worked out in the database.
export async function logReconciliation(balanceBaht: number) {
  if (!(await isAdmin(await getSessionUserId()))) return { error: "ไม่มีสิทธิ์เข้าถึง" as const };
  if (!Number.isFinite(balanceBaht) || balanceBaht < 0) return { error: "ใส่ยอดเงินในบัญชี B เป็นตัวเลข" as const };
  const { error } = await createServiceClient().rpc("log_reconciliation", { p_balance: Math.round(balanceBaht * 100) });
  if (error) {
    console.error("[reconciliation] log failed", error.message);
    return { error: "บันทึกไม่สำเร็จ ลองอีกครั้ง" as const };
  }
  revalidatePath("/admin/reconciliation");
  return { success: true as const };
}

// The admin found this order's payment on account B's bank statement; the reference is that line.
export async function matchOrderPayment(orderId: string, reference: string) {
  if (!(await isAdmin(await getSessionUserId()))) return { error: "ไม่มีสิทธิ์เข้าถึง" as const };
  const { error } = await createServiceClient().rpc("match_order_payment", { p_order: orderId, p_ref: reference });
  if (error) {
    if (error.message.includes("reference_required")) return { error: "ใส่เลขอ้างอิงจาก statement" as const };
    if (error.message.includes("not_matchable")) return { error: "คำสั่งซื้อนี้จับคู่ไปแล้วหรือจับคู่ไม่ได้" as const };
    if (error.message.includes("orders_bank_reference_key")) return { error: "รายการ statement นี้ถูกใช้กับคำสั่งซื้ออื่นแล้ว" as const };
    console.error("[reconciliation] match failed", error.message);
    return { error: "บันทึกไม่สำเร็จ ลองอีกครั้ง" as const };
  }
  revalidatePath("/admin/reconciliation");
  return { success: true as const };
}
