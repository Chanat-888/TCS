"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireVerifiedUserId } from "@/lib/session";

export async function confirmShipment(orderId: string, courier: string, trackingNumber: string) {
  const userId = await requireVerifiedUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };
  if (!courier || !trackingNumber.trim()) return { error: "เลือกบริษัทขนส่งและกรอกเลขพัสดุก่อนยืนยัน" as const };

  const supabase = createServiceClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || order.seller_id !== userId) return { error: "ไม่พบคำสั่งขายนี้" as const };
  if (order.status !== "PAID_HELD") return { error: "คำสั่งขายนี้ไม่ได้อยู่ในสถานะที่ยืนยันจัดส่งได้" as const };
  if (order.delivery_method === "meetup") return { error: "คำสั่งซื้อนี้เป็นการนัดรับ กรุณากดยืนยันการส่งมอบแทน" as const };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("orders")
    .update({ status: "SHIPPED", courier, tracking_number: trackingNumber.trim(), shipped_at: now })
    .eq("id", orderId);
  if (error) return { error: "ยืนยันการจัดส่งไม่สำเร็จ ลองอีกครั้ง" as const };

  revalidatePath(`/orders/${orderId}/seller`);
  return { success: true as const };
}

// Meet-up orders have no courier or tracking number. Handing the card over moves the
// order to SHIPPED so the buyer's unboxing video, approval and dispute steps stay
// exactly as they are for shipped orders.
export async function confirmHandover(orderId: string) {
  const userId = await requireVerifiedUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };

  const supabase = createServiceClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || order.seller_id !== userId) return { error: "ไม่พบคำสั่งขายนี้" as const };
  if (order.delivery_method !== "meetup") return { error: "คำสั่งซื้อนี้เป็นการจัดส่ง กรุณากรอกขนส่งและเลขพัสดุ" as const };
  if (order.status !== "PAID_HELD") return { error: "คำสั่งขายนี้ไม่ได้อยู่ในสถานะที่ยืนยันการส่งมอบได้" as const };

  const { error } = await supabase
    .from("orders")
    .update({ status: "SHIPPED", shipped_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "PAID_HELD");
  if (error) return { error: "ยืนยันการส่งมอบไม่สำเร็จ ลองอีกครั้ง" as const };

  revalidatePath(`/orders/${orderId}/seller`);
  revalidatePath(`/orders/${orderId}`);
  return { success: true as const };
}
