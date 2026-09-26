import type { createServiceClient } from "@/lib/supabase/server";
import { createPendingOrder } from "@/lib/orderCreate";

type Supabase = ReturnType<typeof createServiceClient>;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Timer rules. Change a number here to change the policy.
 *
 * - Unpaid orders cancel at their own payment_deadline_at (24h after creation).
 * - A seller who misses the agreed ship date (plus a grace period), or who has no
 *   agreed date after DEFAULT_SHIP_WINDOW, has the order cancelled and the buyer refunded.
 * - An unanswered ship-date proposal is auto-accepted after PROPOSAL_AUTO_ACCEPT (an
 *   unanswered cancellation request just lapses; silence never cancels an order).
 * - Delivered orders auto-complete when their 48h auto_approve_at passes. With no
 *   courier integration "delivered" is only known once the buyer uploads the unboxing
 *   video, so a shipped order the buyer never confirms completes 2 days after the
 *   expected delivery: DELIVERY_ESTIMATE after shipping (nothing for meet-ups, which
 *   are handed over on the spot).
 */
export const SHIP_GRACE_MS = 24 * HOUR;
export const DEFAULT_SHIP_WINDOW_MS = 3 * DAY;
export const PROPOSAL_AUTO_ACCEPT_MS = 48 * HOUR;
export const AUTO_COMPLETE_AFTER_DELIVERY_MS = 2 * DAY;
export const DELIVERY_ESTIMATE_MS = 5 * DAY;

const BATCH = 50;

export interface StepResult {
  processed: number;
  error?: string;
}

const iso = (ms: number) => new Date(ms).toISOString();

// Every step reads a small batch of candidates, then changes each one with a
// guarded update (conditional on it still being in the state we read). A repeated
// or overlapping run therefore finds nothing left to do, and a user action that
// lands at the same moment simply wins.

async function note(supabase: Supabase, orderId: string, senderId: string, body: string) {
  try {
    await supabase.from("messages").insert({ order_id: orderId, sender_id: senderId, body: `[ระบบ] ${body}` });
  } catch {
    // best effort: never let a chat failure undo the step
  }
}

/** Auctions whose time is up: sell to the top bidder (pending payment) or expire with no bids. */
export async function closeEndedListings(supabase: Supabase, now: number): Promise<StepResult> {
  const { data: listings, error } = await supabase
    .from("listings")
    .select("*")
    .eq("status", "active")
    .lte("ends_at", iso(now))
    .limit(BATCH);
  if (error) return { processed: 0, error: "read listings failed" };

  let processed = 0;
  for (const listing of listings ?? []) {
    const { data: top } = await supabase
      .from("bids")
      .select("bidder_id, amount")
      .eq("listing_id", listing.id)
      .order("amount", { ascending: false })
      .limit(1)
      .maybeSingle();

    // A bid raises the listing price a moment before its row is saved. If the two
    // disagree, a bid is landing right now: leave it for the next run.
    const consistent = top ? top.amount === listing.current_price : listing.current_price === listing.start_price;
    if (!consistent) continue;

    const { data: claimed, error: claimError } = await supabase
      .from("listings")
      .update({ status: top ? "sold" : "expired" })
      .eq("id", listing.id)
      .eq("status", "active")
      .eq("current_price", listing.current_price)
      .lte("ends_at", iso(now))
      .select("id");
    if (claimError || !claimed || claimed.length === 0) continue;

    if (top) {
      const { data: order, error: orderError } = await createPendingOrder(supabase, listing, top.bidder_id, top.amount);
      if (orderError || !order) {
        await supabase.from("listings").update({ status: "active" }).eq("id", listing.id).eq("status", "sold");
        continue;
      }
    }
    processed++;
  }
  return { processed };
}

/** Winners and buyers who did not pay within 24 hours. */
export async function cancelUnpaidOrders(supabase: Supabase, now: number): Promise<StepResult> {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id")
    .eq("status", "PENDING_PAYMENT")
    .lte("payment_deadline_at", iso(now))
    .limit(BATCH);
  if (error) return { processed: 0, error: "read orders failed" };

  let processed = 0;
  for (const order of orders ?? []) {
    const { data: claimed } = await supabase
      .from("orders")
      .update({ status: "CANCELLED", cancelled_at: iso(now) })
      .eq("id", order.id)
      .eq("status", "PENDING_PAYMENT")
      .select("id");
    if (claimed && claimed.length > 0) processed++;
  }
  return { processed };
}

/** Sellers who did not ship by the agreed date (+ grace), or within 3 days of payment if none was agreed. */
export async function cancelLateShipments(supabase: Supabase, now: number): Promise<StepResult> {
  const [agreed, unagreed] = await Promise.all([
    supabase
      .from("orders")
      .select("id, seller_id")
      .eq("status", "PAID_HELD")
      .not("ship_by_at", "is", null)
      .lte("ship_by_at", iso(now - SHIP_GRACE_MS))
      .limit(BATCH),
    supabase
      .from("orders")
      .select("id, seller_id")
      .eq("status", "PAID_HELD")
      .is("ship_by_at", null)
      .lte("paid_at", iso(now - DEFAULT_SHIP_WINDOW_MS))
      .limit(BATCH),
  ]);
  // Before the ship-date migration is applied the columns don't exist: do nothing rather than guess.
  if (agreed.error || unagreed.error) return { processed: 0, error: "read orders failed" };

  let processed = 0;
  for (const [order, reason] of [
    ...(agreed.data ?? []).map((o) => [o, "ผู้ขายไม่จัดส่งภายในวันที่ตกลงกัน"] as const),
    ...(unagreed.data ?? []).map((o) => [o, "ผู้ขายไม่จัดส่งภายใน 3 วันหลังชำระเงิน"] as const),
  ]) {
    const { data: claimed } = await supabase
      .from("orders")
      .update({ status: "CANCELLED", cancelled_at: iso(now) })
      .eq("id", order.id)
      .eq("status", "PAID_HELD")
      .select("id");
    if (claimed && claimed.length > 0) {
      processed++;
      await note(supabase, order.id, order.seller_id, `ยกเลิกคำสั่งซื้ออัตโนมัติ: ${reason} — เงินจะคืนผู้ซื้อ`);
    }
  }
  return { processed };
}

/** Ship-date proposals nobody answered in 48 hours. */
export async function resolveStaleProposals(supabase: Supabase, now: number): Promise<StepResult> {
  const { data: proposals, error } = await supabase
    .from("order_ship_proposals")
    .select("*")
    .eq("status", "pending")
    .lte("created_at", iso(now - PROPOSAL_AUTO_ACCEPT_MS))
    .limit(BATCH);
  if (error) return { processed: 0, error: "read proposals failed" };

  let processed = 0;
  for (const p of proposals ?? []) {
    const accept = p.kind === "ship_date";
    const { data: claimed } = await supabase
      .from("order_ship_proposals")
      .update({ status: accept ? "accepted" : "withdrawn", response_note: "ไม่มีการตอบภายใน 48 ชั่วโมง", responded_at: iso(now) })
      .eq("id", p.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    let applied = false;
    if (accept) {
      const { data: moved } = await supabase
        .from("orders")
        .update({ ship_by_at: p.proposed_date })
        .eq("id", p.order_id)
        .eq("status", "PAID_HELD")
        .select("id");
      applied = Boolean(moved && moved.length > 0);
      // The order moved on (shipped/cancelled) meanwhile: the proposal is simply moot.
      if (!applied) {
        await supabase.from("order_ship_proposals").update({ status: "withdrawn" }).eq("id", p.id).eq("status", "accepted");
      }
    }
    processed++;
    await note(
      supabase,
      p.order_id,
      p.proposed_by,
      applied
        ? "ไม่มีการตอบภายใน 48 ชั่วโมง ระบบยอมรับวันส่งที่เสนอโดยอัตโนมัติ"
        : "ข้อเสนอไม่มีการตอบภายใน 48 ชั่วโมงและหมดอายุแล้ว"
    );
  }
  return { processed };
}

/** Orders the buyer never approved: auto-approve after 48h, or 2 days after the expected delivery. */
export async function autoCompleteOrders(supabase: Supabase, now: number): Promise<StepResult> {
  const [delivered, shipped] = await Promise.all([
    supabase
      .from("orders")
      .select("id, seller_id")
      .eq("status", "DELIVERED")
      .lte("auto_approve_at", iso(now))
      .limit(BATCH),
    supabase
      .from("orders")
      .select("id, seller_id, delivery_method, shipped_at")
      .eq("status", "SHIPPED")
      .is("unboxing_video_url", null)
      .lte("shipped_at", iso(now - AUTO_COMPLETE_AFTER_DELIVERY_MS))
      .limit(BATCH),
  ]);
  if (delivered.error || shipped.error) return { processed: 0, error: "read orders failed" };

  let processed = 0;

  for (const order of delivered.data ?? []) {
    const { data: claimed } = await supabase
      .from("orders")
      .update({ status: "COMPLETED", completed_at: iso(now) })
      .eq("id", order.id)
      .eq("status", "DELIVERED")
      .select("id");
    if (claimed && claimed.length > 0) {
      processed++;
      await note(supabase, order.id, order.seller_id, "ครบ 48 ชั่วโมงหลังผู้ซื้อยืนยันรับพัสดุโดยไม่มีข้อพิพาท ระบบอนุมัติอัตโนมัติ");
    }
  }

  for (const order of shipped.data ?? []) {
    // Meet-ups are handed over on the spot; parcels get the delivery estimate first.
    const due = order.delivery_method === "meetup" ? AUTO_COMPLETE_AFTER_DELIVERY_MS : DELIVERY_ESTIMATE_MS + AUTO_COMPLETE_AFTER_DELIVERY_MS;
    if (new Date(order.shipped_at).getTime() > now - due) continue;
    const { data: claimed } = await supabase
      .from("orders")
      .update({ status: "COMPLETED", completed_at: iso(now) })
      .eq("id", order.id)
      .eq("status", "SHIPPED")
      .is("unboxing_video_url", null)
      .select("id");
    if (claimed && claimed.length > 0) {
      processed++;
      await note(supabase, order.id, order.seller_id, "ผู้ซื้อไม่ยืนยันรับสินค้าและไม่เปิดข้อพิพาทหลังพ้นกำหนด ระบบอนุมัติอัตโนมัติ");
    }
  }
  return { processed };
}

const STEPS = {
  closeEndedListings,
  cancelUnpaidOrders,
  cancelLateShipments,
  resolveStaleProposals,
  autoCompleteOrders,
} as const;

/** Runs every timer step; one failing step never stops the others. */
export async function runAllTimers(supabase: Supabase, now: number = Date.now()): Promise<Record<string, StepResult>> {
  const results: Record<string, StepResult> = {};
  for (const [name, step] of Object.entries(STEPS)) {
    try {
      results[name] = await step(supabase, now);
    } catch {
      results[name] = { processed: 0, error: "step failed" };
    }
  }
  return results;
}
