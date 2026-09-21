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
