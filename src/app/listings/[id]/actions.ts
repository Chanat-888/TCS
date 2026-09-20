"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/session";

const BID_INCREMENT = 100;
const ANTI_SNIPE_WINDOW_SECONDS = 120;
const ANTI_SNIPE_EXTENSION_SECONDS = 120;

export async function placeBid(listingId: string, amount: number) {
  const userId = await getSessionUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อนบิด" as const };

  const supabase = createServiceClient();
  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle();
  if (fetchError || !listing) return { error: "ไม่พบประกาศนี้" as const };
  if (listing.seller_id === userId) return { error: "คุณไม่สามารถบิดประกาศของตัวเองได้" as const };
  if (listing.status !== "active") return { error: "ประกาศนี้ปิดการประมูลแล้ว" as const };
  if (new Date(listing.ends_at).getTime() <= Date.now()) return { error: "หมดเวลาประมูลแล้ว" as const };

  const minBid = listing.current_price + BID_INCREMENT;
  if (amount < minBid) return { error: `กรอกจำนวนเงินอย่างน้อยราคาบิดขั้นต่ำ` as const };

  const secondsLeft = (new Date(listing.ends_at).getTime() - Date.now()) / 1000;
  const extended = secondsLeft < ANTI_SNIPE_WINDOW_SECONDS;
  const newEndsAt = extended
    ? new Date(new Date(listing.ends_at).getTime() + ANTI_SNIPE_EXTENSION_SECONDS * 1000).toISOString()
    : listing.ends_at;

  const { data: bid, error: bidError } = await supabase
    .from("bids")
    .insert({ listing_id: listingId, bidder_id: userId, amount })
    .select()
    .single();
  if (bidError || !bid) return { error: "บิดไม่สำเร็จ ลองอีกครั้ง" as const };

  const { error: updateError } = await supabase
    .from("listings")
    .update({ current_price: amount, ends_at: newEndsAt })
    .eq("id", listingId);
  if (updateError) return { error: "บิดไม่สำเร็จ ลองอีกครั้ง" as const };

  revalidatePath(`/listings/${listingId}`);
  return { success: true as const, extended, newEndsAt, newPrice: amount, bid };
}

function generateOrderCode() {
  const now = new Date();
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const suffix = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `TCS-${yy}${mm}${dd}-${suffix}`;
}

export async function buyNow(listingId: string) {
  const userId = await getSessionUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อนซื้อ" as const };

  const supabase = createServiceClient();
  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle();
  if (fetchError || !listing) return { error: "ไม่พบประกาศนี้" as const };
  if (listing.buy_now_price == null) return { error: "ประกาศนี้ไม่รองรับการซื้อทันที" as const };
  if (listing.seller_id === userId) return { error: "คุณไม่สามารถซื้อประกาศของตัวเองได้" as const };
  if (listing.status !== "active") return { error: "ประกาศนี้ถูกขายไปแล้ว" as const };

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_code: generateOrderCode(),
      listing_id: listingId,
      buyer_id: userId,
      seller_id: listing.seller_id,
      amount: listing.buy_now_price,
      status: "PENDING_PAYMENT",
      payment_deadline_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();
  if (orderError || !order) return { error: "สร้างคำสั่งซื้อไม่สำเร็จ ลองอีกครั้ง" as const };

  const { error: updateError } = await supabase.from("listings").update({ status: "sold" }).eq("id", listingId);
  if (updateError) return { error: "เกิดข้อผิดพลาด ลองอีกครั้ง" as const };

  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/browse");
  return { success: true as const, orderId: order.id as string };
}
