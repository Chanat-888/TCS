"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireVerifiedUserId } from "@/lib/session";
import { createPendingOrder } from "@/lib/orderCreate";
import { MAX_SPREAD_ITEMS, totalPrice } from "@/lib/spreadPost";

type Supabase = ReturnType<typeof createServiceClient>;

const TAKEN = "การ์ดบางใบมีคนเลือกไปแล้ว กรุณารีเฟรชแล้วเลือกใหม่";

// Give back cards this buyer just claimed but did not end up buying. Conditional on
// them still being this buyer's un-ordered claims, so it can never free someone else's.
async function release(supabase: Supabase, userId: string, ids: string[]) {
  if (ids.length === 0) return;
  await supabase
    .from("listing_items")
    .update({ status: "available", reserved_by: null, order_id: null })
    .in("id", ids)
    .eq("reserved_by", userId)
    .eq("status", "reserved");
}

/**
 * The buyer picks cards from a spread post and gets ONE order for all of them, ready
 * to pay. Cards are claimed with a single guarded update (only those still
 * "available"), so if two people pick the same card, whoever's update lands first
 * gets it and the other is told to re-pick. Unpaid orders are cancelled by the timer
 * and a database trigger then gives the cards back.
 */
export async function reserveItems(listingId: string, itemIds: string[]) {
  const userId = await requireVerifiedUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };

  const ids = Array.isArray(itemIds) ? [...new Set(itemIds.filter((id) => typeof id === "string" && id.length > 0))] : [];
  if (ids.length === 0) return { error: "เลือกการ์ดอย่างน้อย 1 ใบ" as const };
  if (ids.length > MAX_SPREAD_ITEMS) return { error: "เลือกการ์ดมากเกินไป" as const };

  const supabase = createServiceClient();
  const { data: listing } = await supabase.from("listings").select("*").eq("id", listingId).maybeSingle();
  if (!listing || listing.post_kind !== "spread") return { error: "ไม่พบโพสต์นี้" as const };
  if (listing.seller_id === userId) return { error: "คุณไม่สามารถซื้อโพสต์ของตัวเองได้" as const };
  if (listing.status !== "active") return { error: "โพสต์นี้ปิดแล้ว" as const };

  // One unpaid order per buyer per post: otherwise someone could reserve every card
  // with several orders and lock the seller's stock for 24 hours.
  const { data: unpaid } = await supabase
    .from("orders")
    .select("id")
    .eq("buyer_id", userId)
    .eq("listing_id", listingId)
    .eq("status", "PENDING_PAYMENT")
    .limit(1)
    .maybeSingle();
  if (unpaid) return { error: "คุณมีรายการที่ยังไม่ได้ชำระเงินในโพสต์นี้ กรุณาชำระเงินก่อน" as const, orderId: unpaid.id as string };

  const { data: claimed, error: claimError } = await supabase
    .from("listing_items")
    .update({ status: "reserved", reserved_by: userId })
    .eq("listing_id", listingId)
    .in("id", ids)
    .eq("status", "available")
    .select("id, price");
  if (claimError) return { error: "จองการ์ดไม่สำเร็จ ลองอีกครั้ง" as const };
  const got = claimed ?? [];
  if (got.length !== ids.length) {
    await release(supabase, userId, got.map((c) => c.id as string));
    return { error: TAKEN };
  }
  const claimedIds = got.map((c) => c.id as string);

  const { data: order, error: orderError } = await createPendingOrder(supabase, listing, userId, totalPrice(got as { price: number }[]));
  if (orderError || !order) {
    await release(supabase, userId, claimedIds);
    return { error: "สร้างคำสั่งซื้อไม่สำเร็จ ลองอีกครั้ง" as const };
  }

  const { data: attached, error: attachError } = await supabase
    .from("listing_items")
    .update({ order_id: order.id })
    .in("id", claimedIds)
    .eq("reserved_by", userId)
    .eq("status", "reserved")
    .is("order_id", null)
    .select("id");
  if (attachError || !attached || attached.length !== claimedIds.length) {
    // Could not tie every card to the order: cancel it (the trigger frees the cards).
    await supabase.from("orders").update({ status: "CANCELLED", cancelled_at: new Date().toISOString() }).eq("id", order.id).eq("status", "PENDING_PAYMENT");
    await release(supabase, userId, claimedIds);
    return { error: "จองการ์ดไม่สำเร็จ ลองอีกครั้ง" as const };
  }

  revalidatePath(`/listings/${listingId}`);
  return { success: true as const, orderId: order.id as string };
}

/** The seller closes their own spread post. Cards already in someone's order stay theirs. */
export async function closeSpreadPost(listingId: string) {
  const userId = await requireVerifiedUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };

  const supabase = createServiceClient();
  const { data: listing } = await supabase.from("listings").select("*").eq("id", listingId).maybeSingle();
  if (!listing || listing.post_kind !== "spread") return { error: "ไม่พบโพสต์นี้" as const };
  if (listing.seller_id !== userId) return { error: "เฉพาะเจ้าของโพสต์เท่านั้นที่ปิดโพสต์ได้" as const };

  const { data: claimed, error } = await supabase
    .from("listings")
    .update({ status: "cancelled" })
    .eq("id", listingId)
    .eq("status", "active")
    .select("id");
  if (error) return { error: "ปิดโพสต์ไม่สำเร็จ ลองอีกครั้ง" as const };
  if (!claimed || claimed.length === 0) return { error: "โพสต์นี้ปิดไปแล้ว" as const };

  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/browse");
  return { success: true as const };
}
