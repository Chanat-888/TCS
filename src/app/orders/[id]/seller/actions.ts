"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requirePhoneVerifiedUserId } from "@/lib/session";

export async function confirmShipment(orderId: string, courier: string, trackingNumber: string) {
  const userId = await requirePhoneVerifiedUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };
  if (!courier || !trackingNumber.trim()) return { error: "เลือกบริษัทขนส่งและกรอกเลขพัสดุก่อนยืนยัน" as const };

  const supabase = createServiceClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || order.seller_id !== userId) return { error: "ไม่พบคำสั่งขายนี้" as const };
  if (order.status !== "PAID_HELD") return { error: "คำสั่งขายนี้ไม่ได้อยู่ในสถานะที่ยืนยันจัดส่งได้" as const };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("orders")
    .update({ status: "SHIPPED", courier, tracking_number: trackingNumber.trim(), shipped_at: now })
    .eq("id", orderId);
  if (error) return { error: "ยืนยันการจัดส่งไม่สำเร็จ ลองอีกครั้ง" as const };

  revalidatePath(`/orders/${orderId}/seller`);
  return { success: true as const };
}
