"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireVerifiedUserId } from "@/lib/session";
import { bidIncrementOf, isBuyNowAvailable, isFixedPrice } from "@/lib/listingKind";
import type { Bid } from "@/lib/supabase/types";

const ANTI_SNIPE_WINDOW_SECONDS = 120;
const ANTI_SNIPE_EXTENSION_SECONDS = 120;

type PlaceBidResult =
  | { error: string }
  | { success: true; won: true; orderId: string; extended: false; newEndsAt: string; newPrice: number; bid: Bid }
  | { success: true; won: false; extended: boolean; newEndsAt: string; newPrice: number; bid: Bid };

// A bid that loses the race for the price is re-checked against the new price a
// couple of times: first to commit wins, but a genuinely higher bid must not be
// refused just because a lower one landed a moment earlier.
const BID_RACE_RETRIES = 2;

export async function placeBid(listingId: string, amount: number): Promise<PlaceBidResult> {
  const userId = await requireVerifiedUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อนบิด" };
  return attemptBid(listingId, amount, userId, BID_RACE_RETRIES);
}

async function attemptBid(listingId: string, amount: number, userId: string, retries: number): Promise<PlaceBidResult> {
  const supabase = createServiceClient();
  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle();
  if (fetchError || !listing) return { error: "ไม่พบประกาศนี้" };
  if (listing.seller_id === userId) return { error: "คุณไม่สามารถบิดประกาศของตัวเองได้" };
  if (listing.status !== "active") return { error: "ประกาศนี้ปิดการประมูลแล้ว" };
  if (new Date(listing.ends_at).getTime() <= Date.now()) return { error: "หมดเวลาประมูลแล้ว" };
  if (isFixedPrice(listing)) return { error: "ประกาศนี้ขายราคาตายตัว ไม่มีการประมูล" };

  // Bidding up to the seller's buy-now price wins instantly, so that price is
  // always reachable even when the next increment would step past it.
  const buyNowPrice: number | null = listing.buy_now_price;
  const minBid = Math.min(listing.current_price + bidIncrementOf(listing), buyNowPrice ?? Infinity);
  if (amount < minBid) return { error: `กรอกจำนวนเงินอย่างน้อยราคาบิดขั้นต่ำ` };

  const { data: topBid } = await supabase
    .from("bids")
    .select("bidder_id")
    .eq("listing_id", listingId)
    .order("amount", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (topBid?.bidder_id === userId) return { error: "คุณเป็นผู้บิดสูงสุดอยู่แล้ว" };

  const instantWin = buyNowPrice != null && amount >= buyNowPrice;
  if (instantWin) amount = buyNowPrice;

  const secondsLeft = (new Date(listing.ends_at).getTime() - Date.now()) / 1000;
  const extended = !instantWin && secondsLeft < ANTI_SNIPE_WINDOW_SECONDS;
  const newEndsAt = extended
    ? new Date(new Date(listing.ends_at).getTime() + ANTI_SNIPE_EXTENSION_SECONDS * 1000).toISOString()
    : listing.ends_at;

  // Claim the price move first, conditional on the listing still being active at
  // the price we read, so a concurrent bid or buy-now can't be silently overwritten.
  const { data: claimed, error: updateError } = await supabase
    .from("listings")
    .update(instantWin ? { current_price: amount, status: "sold" } : { current_price: amount, ends_at: newEndsAt })
    .eq("id", listingId)
    .eq("status", "active")
    .eq("current_price", listing.current_price)
    .select("id");
  if (updateError) return { error: "บิดไม่สำเร็จ ลองอีกครั้ง" };
  if (!claimed || claimed.length === 0) {
    if (retries > 0) return attemptBid(listingId, amount, userId, retries - 1);
    return { error: "ราคาเปลี่ยนไปแล้วหรือประกาศถูกขายไปแล้ว กรุณารีเฟรชแล้วลองอีกครั้ง" };
  }

  const { data: bid, error: bidError } = await supabase
    .from("bids")
    .insert({ listing_id: listingId, bidder_id: userId, amount })
    .select()
    .single();
  const reopen = () =>
    supabase
      .from("listings")
      .update({ current_price: listing.current_price, ends_at: listing.ends_at, status: "active" })
      .eq("id", listingId)
      .eq("current_price", amount);
  if (bidError || !bid) {
    await reopen();
    return { error: "บิดไม่สำเร็จ ลองอีกครั้ง" };
  }

  if (instantWin) {
    const { data: order, error: orderError } = await createPendingOrder(supabase, listing, userId, amount);
    if (orderError || !order) {
      await supabase.from("bids").delete().eq("id", bid.id);
      await reopen();
      return { error: "สร้างคำสั่งซื้อไม่สำเร็จ ลองอีกครั้ง" };
    }
    revalidatePath(`/listings/${listingId}`);
    revalidatePath("/browse");
    return { success: true, won: true, orderId: order.id as string, extended: false, newEndsAt, newPrice: amount, bid };
  }

  revalidatePath(`/listings/${listingId}`);
  return { success: true, won: false, extended, newEndsAt, newPrice: amount, bid };
}

function generateOrderCode() {
  const now = new Date();
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const suffix = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `TCS-${yy}${mm}${dd}-${suffix}`;
}

function createPendingOrder(
  supabase: ReturnType<typeof createServiceClient>,
  listing: { id: string; seller_id: string },
  buyerId: string,
  amount: number
) {
  return supabase
    .from("orders")
    .insert({
      order_code: generateOrderCode(),
      listing_id: listing.id,
      buyer_id: buyerId,
      seller_id: listing.seller_id,
      amount,
      status: "PENDING_PAYMENT",
      payment_deadline_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();
}

export async function buyNow(listingId: string) {
  const userId = await requireVerifiedUserId();
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
  if (!isBuyNowAvailable(listing)) return { error: "มีการบิดเข้ามาแล้ว จึงซื้อทันทีไม่ได้อีก" as const };

  // Claim the listing atomically: only succeeds while it is still active AND
  // unbid (current_price still equals start_price), so two buyers, or a buyer and
  // a bidder, can't both win.
  const { data: claimed, error: claimError } = await supabase
    .from("listings")
    .update({ status: "sold" })
    .eq("id", listingId)
    .eq("status", "active")
    .eq("current_price", listing.start_price)
    .select("id");
  if (claimError) return { error: "เกิดข้อผิดพลาด ลองอีกครั้ง" as const };
  if (!claimed || claimed.length === 0) return { error: "ประกาศนี้ถูกขายไปแล้วหรือมีการบิดเข้ามา" as const };

  const { data: order, error: orderError } = await createPendingOrder(supabase, listing, userId, listing.buy_now_price);
  if (orderError || !order) {
    await supabase.from("listings").update({ status: "active" }).eq("id", listingId);
    return { error: "สร้างคำสั่งซื้อไม่สำเร็จ ลองอีกครั้ง" as const };
  }

  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/browse");
  return { success: true as const, orderId: order.id as string };
}

/**
 * Seller closes their own listing early. With bids, the top bidder wins at their
 * bid and gets a pending-payment order; with none, the listing is cancelled.
 * Guarded on the price we read, so a bid landing at the same moment can't be lost.
 */
export async function endAuctionNow(listingId: string) {
  const userId = await requireVerifiedUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };

  const supabase = createServiceClient();
  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle();
  if (fetchError || !listing) return { error: "ไม่พบประกาศนี้" as const };
  if (listing.seller_id !== userId) return { error: "เฉพาะเจ้าของประกาศเท่านั้นที่ปิดประมูลได้" as const };
  if (listing.status !== "active") return { error: "ประกาศนี้ปิดไปแล้ว" as const };

  const { data: topBid } = await supabase
    .from("bids")
    .select("bidder_id, amount")
    .eq("listing_id", listingId)
    .order("amount", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextStatus = topBid ? "sold" : "cancelled";
  const { data: claimed, error: claimError } = await supabase
    .from("listings")
    .update({ status: nextStatus })
    .eq("id", listingId)
    .eq("status", "active")
    .eq("current_price", listing.current_price)
    .select("id");
  if (claimError) return { error: "เกิดข้อผิดพลาด ลองอีกครั้ง" as const };
  if (!claimed || claimed.length === 0) return { error: "มีการบิดเข้ามาใหม่ กรุณารีเฟรชแล้วลองอีกครั้ง" as const };

  if (!topBid) {
    revalidatePath(`/listings/${listingId}`);
    revalidatePath("/browse");
    return { success: true as const, outcome: "cancelled" as const };
  }

  const { data: order, error: orderError } = await createPendingOrder(supabase, listing, topBid.bidder_id, topBid.amount);
  if (orderError || !order) {
    await supabase.from("listings").update({ status: "active" }).eq("id", listingId);
    return { error: "สร้างคำสั่งซื้อไม่สำเร็จ ลองอีกครั้ง" as const };
  }

  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/browse");
  return { success: true as const, outcome: "sold" as const, orderId: order.id as string };
}
