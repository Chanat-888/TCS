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
  if (dispute.decision) return { error: "ข้อพิพาทนี้ตัดสินไปแล้ว" as const };

  // Claim the decision first (only while undecided), then move the order (only
  // while still DISPUTED). A double click, or two admins, can never decide twice
  // or flip an order that has already been paid out or refunded.
  const now = new Date().toISOString();
  const { data: claimed, error: disputeError } = await supabase
    .from("disputes")
    .update({ decision, resolution_note: note.trim(), decided_at: now })
    .eq("id", disputeId)
    .is("decision", null)
    .select("id");
  if (disputeError) return { error: "ยืนยันผลไม่สำเร็จ ลองอีกครั้ง" as const };
  if (!claimed || claimed.length === 0) return { error: "ข้อพิพาทนี้ตัดสินไปแล้ว" as const };

  const newStatus = decision === "refund" ? "REFUNDED" : "COMPLETED";
  const { data: moved, error: orderError } = await supabase
    .from("orders")
    .update({ status: newStatus, completed_at: decision === "release" ? now : null })
    .eq("id", dispute.order_id)
    .eq("status", "DISPUTED")
    .select("id");
  if (orderError || !moved || moved.length === 0) {
    await supabase.from("disputes").update({ decision: null, resolution_note: null, decided_at: null }).eq("id", disputeId);
    return { error: orderError ? ("ยืนยันผลไม่สำเร็จ ลองอีกครั้ง" as const) : ("คำสั่งซื้อนี้ไม่ได้อยู่ในสถานะข้อพิพาทแล้ว" as const) };
  }

  revalidatePath(`/admin/disputes/${disputeId}`);
  return { success: true as const };
}
