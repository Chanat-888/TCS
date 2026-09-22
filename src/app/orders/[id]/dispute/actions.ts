"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireVerifiedUserId } from "@/lib/session";
import type { DisputeReason } from "@/lib/supabase/types";

export async function fileDispute(orderId: string, reason: DisputeReason, description: string) {
  const userId = await requireVerifiedUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };

  const supabase = createServiceClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || order.buyer_id !== userId) return { error: "ไม่พบคำสั่งซื้อนี้" as const };
  if (!order.unboxing_video_url) return { error: "ต้องมีวิดีโอแกะกล่องก่อนเปิดข้อพิพาท" as const };
  if (order.status !== "DELIVERED") return { error: "คำสั่งซื้อนี้ไม่ได้อยู่ในสถานะที่เปิดข้อพิพาทได้" as const };

  const { error: disputeError } = await supabase
    .from("disputes")
    .insert({ order_id: orderId, opened_by: userId, reason, description });
  if (disputeError) return { error: "ส่งข้อพิพาทไม่สำเร็จ ลองอีกครั้ง" as const };

  const { error: orderError } = await supabase.from("orders").update({ status: "DISPUTED" }).eq("id", orderId);
  if (orderError) return { error: "ส่งข้อพิพาทไม่สำเร็จ ลองอีกครั้ง" as const };

  revalidatePath(`/orders/${orderId}`);
  return { success: true as const };
}

// Meet-up orders have no tracking number and no courier, so the seller's own
// "handed over" claim (or lack of one) is the only signal — a buyer who
// received nothing can never produce the unboxing video a normal dispute
// requires. This opens a dispute straight from PAID_HELD/SHIPPED instead,
// with the buyer's own account of what happened as the evidence.
export async function reportMeetupNoShow(orderId: string, description: string) {
  const userId = await requireVerifiedUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };

  const cleaned = description.trim().slice(0, 500);
  if (cleaned.length < 10) return { error: "อธิบายเหตุการณ์ที่เกิดขึ้นอย่างน้อย 10 ตัวอักษร" as const };

  const supabase = createServiceClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || order.buyer_id !== userId) return { error: "ไม่พบคำสั่งซื้อนี้" as const };
  if (order.delivery_method !== "meetup") return { error: "ใช้ได้เฉพาะคำสั่งซื้อแบบนัดรับ" as const };
  if (order.unboxing_video_url) return { error: "คำสั่งซื้อนี้มีวิดีโอแกะกล่องแล้ว กรุณาเปิดข้อพิพาทตามปกติ" as const };
  if (order.status !== "PAID_HELD" && order.status !== "SHIPPED") {
    return { error: "คำสั่งขายนี้ไม่ได้อยู่ในสถานะที่แจ้งปัญหานี้ได้" as const };
  }

  const { error: disputeError } = await supabase
    .from("disputes")
    .insert({ order_id: orderId, opened_by: userId, reason: "not_received", description: cleaned });
  if (disputeError) return { error: "ส่งเรื่องไม่สำเร็จ ลองอีกครั้ง" as const };

  const { error: orderError } = await supabase
    .from("orders")
    .update({ status: "DISPUTED" })
    .eq("id", orderId)
    .in("status", ["PAID_HELD", "SHIPPED"]);
  if (orderError) return { error: "ส่งเรื่องไม่สำเร็จ ลองอีกครั้ง" as const };

  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}/seller`);
  return { success: true as const };
}
