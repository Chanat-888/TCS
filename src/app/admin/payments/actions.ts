"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/session";
import { isAdmin } from "@/lib/admin";

// The admin compared the buyer's slip with account B's bank statement.
//   accept: note = the statement reference (marks the order paid and matched, once per statement line)
//   reject: note = the reason the buyer will see
//   refund: note = why; the money is refunded by hand to the account that paid, then recorded below
export interface Payer { name: string; bank: string; hint: string }

export async function decideSlip(slipId: string, decision: "accept" | "reject" | "refund", note: string, payer: Payer) {
  const adminId = await getSessionUserId();
  if (!(await isAdmin(adminId))) return { error: "ไม่มีสิทธิ์เข้าถึง" as const };
  const { error } = await createServiceClient().rpc("decide_slip", {
    p_slip: slipId, p_decision: decision, p_note: note, p_admin: adminId,
    p_payer_name: payer.name, p_payer_bank: payer.bank, p_payer_hint: payer.hint,
  });
  if (error) {
    if (error.message.includes("reference_required")) return { error: "ใส่เลขอ้างอิงของรายการใน statement" as const };
    if (error.message.includes("not_in_review")) return { error: "สลิปนี้ตัดสินไปแล้ว" as const };
    if (error.message.includes("order_not_payable")) return { error: "คำสั่งซื้อนี้ไม่ได้รอชำระเงินแล้ว (ยกเลิกหรือชำระแล้ว) ให้เลือก \"ต้องคืนเงิน\"" as const };
    if (error.message.includes("orders_bank_reference_key")) return { error: "รายการ statement นี้ถูกใช้กับคำสั่งซื้ออื่นแล้ว" as const };
    console.error("[payments] decide failed", error.message);
    return { error: "บันทึกไม่สำเร็จ ลองอีกครั้ง" as const };
  }
  revalidatePath("/admin/payments");
  return { success: true as const };
}

// A typo in the payer fields found after the decision. The slip image stays the source of truth.
export async function fixPayer(slipId: string, payer: Payer) {
  if (!(await isAdmin(await getSessionUserId()))) return { error: "ไม่มีสิทธิ์เข้าถึง" as const };
  const { error } = await createServiceClient().rpc("fix_payer", { p_slip: slipId, p_name: payer.name, p_bank: payer.bank, p_hint: payer.hint });
  if (error) {
    if (error.message.includes("not_decided")) return { error: "แก้ไขได้เฉพาะสลิปที่ตัดสินแล้ว" as const };
    console.error("[payments] fix payer failed", error.message);
    return { error: "บันทึกไม่สำเร็จ ลองอีกครั้ง" as const };
  }
  revalidatePath("/admin/payments");
  return { success: true as const };
}

export async function finishRefund(slipId: string, reference: string) {
  const adminId = await getSessionUserId();
  if (!(await isAdmin(adminId))) return { error: "ไม่มีสิทธิ์เข้าถึง" as const };
  const { error } = await createServiceClient().rpc("finish_refund", { p_slip: slipId, p_ref: reference, p_admin: adminId });
  if (error) {
    if (error.message.includes("reference_required")) return { error: "ใส่เลขอ้างอิงการโอนคืน" as const };
    if (error.message.includes("not_refund_due")) return { error: "รายการนี้ไม่ได้รอคืนเงินแล้ว" as const };
    console.error("[payments] refund failed", error.message);
    return { error: "บันทึกไม่สำเร็จ ลองอีกครั้ง" as const };
  }
  revalidatePath("/admin/payments");
  return { success: true as const };
}
