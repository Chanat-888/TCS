"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/session";
import type { DisputeDecision } from "@/lib/supabase/types";

export async function resolveDispute(disputeId: string, decision: DisputeDecision, note: string) {
  const userId = await getSessionUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };
  if (!note.trim()) return { error: "เลือกผลการตัดสินและกรอกเหตุผลก่อนยืนยัน" as const };

  const supabase = createServiceClient();
  const { data: viewer } = await supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  if (!viewer?.is_admin) return { error: "ไม่มีสิทธิ์เข้าถึง" as const };

  const { data: dispute } = await supabase.from("disputes").select("*").eq("id", disputeId).maybeSingle();
  if (!dispute) return { error: "ไม่พบข้อพิพาทนี้" as const };

  const now = new Date().toISOString();
  const { error: disputeError } = await supabase
    .from("disputes")
    .update({ decision, resolution_note: note.trim(), decided_at: now })
    .eq("id", disputeId);
  if (disputeError) return { error: "ยืนยันผลไม่สำเร็จ ลองอีกครั้ง" as const };

  const newStatus = decision === "refund" ? "REFUNDED" : "COMPLETED";
  const { error: orderError } = await supabase
    .from("orders")
    .update({ status: newStatus, completed_at: decision === "release" ? now : null })
    .eq("id", dispute.order_id);
  if (orderError) return { error: "ยืนยันผลไม่สำเร็จ ลองอีกครั้ง" as const };

  revalidatePath(`/admin/disputes/${disputeId}`);
  return { success: true as const };
}
