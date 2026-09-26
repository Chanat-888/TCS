"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireVerifiedUserId } from "@/lib/session";

// TCS always needs video from both sides: the seller's packing video before
// anything leaves their hands, and the buyer's unboxing video on receipt.
const PACKING_VIDEO_REQUIRED = "อัปโหลดวิดีโอแพ็คของก่อนยืนยัน — TCS ต้องมีวิดีโอจากทั้งผู้ขายและผู้ซื้อทุกออเดอร์";

export async function confirmShipment(orderId: string, courier: string, trackingNumber: string) {
  const userId = await requireVerifiedUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };
  if (!courier || !trackingNumber.trim()) return { error: "เลือกบริษัทขนส่งและกรอกเลขพัสดุก่อนยืนยัน" as const };

  const supabase = createServiceClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || order.seller_id !== userId) return { error: "ไม่พบคำสั่งขายนี้" as const };
  if (order.status !== "PAID_HELD") return { error: "คำสั่งขายนี้ไม่ได้อยู่ในสถานะที่ยืนยันจัดส่งได้" as const };
  if (order.delivery_method === "meetup") return { error: "คำสั่งซื้อนี้เป็นการนัดรับ กรุณากดยืนยันการส่งมอบแทน" as const };
  if (!order.packing_video_url) return { error: PACKING_VIDEO_REQUIRED };

  const now = new Date().toISOString();
  const { data: claimed, error } = await supabase
    .from("orders")
    .update({ status: "SHIPPED", courier, tracking_number: trackingNumber.trim(), shipped_at: now })
    .eq("id", orderId)
    .eq("status", "PAID_HELD")
    .select("id");
  if (error) return { error: "ยืนยันการจัดส่งไม่สำเร็จ ลองอีกครั้ง" as const };
  if (!claimed || claimed.length === 0) return { error: "สถานะคำสั่งขายเปลี่ยนไปแล้ว กรุณารีเฟรชหน้า" as const };

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
  if (!order.packing_video_url) return { error: PACKING_VIDEO_REQUIRED };

  const { data: claimed, error } = await supabase
    .from("orders")
    .update({ status: "SHIPPED", shipped_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "PAID_HELD")
    .select("id");
  if (error) return { error: "ยืนยันการส่งมอบไม่สำเร็จ ลองอีกครั้ง" as const };
  if (!claimed || claimed.length === 0) return { error: "สถานะคำสั่งขายเปลี่ยนไปแล้ว กรุณารีเฟรชหน้า" as const };

  revalidatePath(`/orders/${orderId}/seller`);
  revalidatePath(`/orders/${orderId}`);
  return { success: true as const };
}
