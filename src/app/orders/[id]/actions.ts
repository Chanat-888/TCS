"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/session";

export async function approveOrder(orderId: string) {
  const userId = await getSessionUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };

  const supabase = createServiceClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || order.buyer_id !== userId) return { error: "ไม่พบคำสั่งซื้อนี้" as const };
  if (!order.unboxing_video_url) return { error: "อัปโหลดวิดีโอแกะกล่องก่อนกดรับการ์ด" as const };
  if (order.status !== "DELIVERED") return { error: "คำสั่งซื้อนี้ไม่ได้อยู่ในสถานะที่กดรับได้" as const };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("orders")
    .update({ status: "COMPLETED", approved_at: now, completed_at: now })
    .eq("id", orderId);
  if (error) return { error: "ดำเนินการไม่สำเร็จ ลองอีกครั้ง" as const };

  revalidatePath(`/orders/${orderId}`);
  return { success: true as const };
}

export async function sendOrderMessage(orderId: string, body: string) {
  const userId = await getSessionUserId();
  if (!userId || !body.trim()) return { error: "ส่งข้อความไม่สำเร็จ" as const };

  const supabase = createServiceClient();
  const { data: order } = await supabase.from("orders").select("buyer_id, seller_id").eq("id", orderId).maybeSingle();
  if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) return { error: "ส่งข้อความไม่สำเร็จ" as const };

  const { error } = await supabase.from("messages").insert({ order_id: orderId, sender_id: userId, body: body.trim() });
  if (error) return { error: "ส่งข้อความไม่สำเร็จ" as const };

  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}/seller`);
  return { success: true as const };
}
