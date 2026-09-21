"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireVerifiedUserId } from "@/lib/session";

export async function submitReview(orderId: string, rating: number, tags: string[], comment: string) {
  const userId = await requireVerifiedUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };
  if (!rating) return { error: "เลือกจำนวนดาวก่อนส่งรีวิว" as const };

  const supabase = createServiceClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || order.buyer_id !== userId) return { error: "ไม่พบคำสั่งซื้อนี้" as const };
  if (order.status !== "COMPLETED") return { error: "รีวิวได้เฉพาะคำสั่งซื้อที่เสร็จสมบูรณ์แล้ว" as const };

  const { data: listing } = await supabase.from("listings").select("name").eq("id", order.listing_id).single();

  const { error } = await supabase.from("reviews").insert({
    order_id: orderId,
    rater_id: userId,
    ratee_id: order.seller_id,
    rating,
    tags,
    comment: comment.trim() || null,
    listing_name: listing?.name ?? "",
  });
  if (error) return { error: error.code === "23505" ? "คุณรีวิวคำสั่งซื้อนี้ไปแล้ว" as const : "ส่งรีวิวไม่สำเร็จ ลองอีกครั้ง" as const };

  return { success: true as const };
}
