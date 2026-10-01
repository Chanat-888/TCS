import type { createServiceClient } from "@/lib/supabase/server";
import { omise } from "@/lib/omise";
import { splitPayout } from "@/lib/commission";
import type { StepResult } from "@/lib/orderTimers";

type Supabase = ReturnType<typeof createServiceClient>;

/** A payout stuck in 'processing' this long is retried (the Omise idempotency key makes that safe). */
const STALE_PROCESSING_MS = 10 * 60 * 1000;
const BATCH = 20;

interface OmiseTransfer {
  id: string;
  failure_code?: string | null;
}

/**
 * Pays sellers for completed orders. Orders reach payout_status 'pending' through a
 * database trigger; this sweep (run by the same cron as the timers) turns each into an
 * Omise transfer to the seller's saved bank recipient. Orders whose seller has no bank
 * account yet stay pending until they add one. The row is claimed before calling
 * Omise, and the transfer carries an idempotency key per order, so overlapping or
 * repeated runs can never pay twice.
 */
export async function payOutOrders(supabase: Supabase, now: number): Promise<StepResult> {
  const stale = new Date(now - STALE_PROCESSING_MS).toISOString();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, seller_id, amount, payout_status, payout_attempted_at")
    .or(`payout_status.eq.pending,and(payout_status.eq.processing,payout_attempted_at.lte.${stale})`)
    .limit(BATCH);
  if (error) return { processed: 0, error: "read payouts failed" };

  let processed = 0;
  for (const order of orders ?? []) {
    const { data: account } = await supabase
      .from("seller_payout_accounts")
      .select("omise_recipient_id")
      .eq("user_id", order.seller_id)
      .maybeSingle();
    if (!account) continue;

    const { commission, payout } = splitPayout(order.amount);
    const claim = supabase
      .from("orders")
      .update({ payout_status: "processing", payout_attempted_at: new Date(now).toISOString(), commission, payout_amount: payout })
      .eq("id", order.id)
      .eq("payout_status", order.payout_status);
    const { data: claimed } = await (order.payout_attempted_at
      ? claim.eq("payout_attempted_at", order.payout_attempted_at)
      : claim.is("payout_attempted_at", null)
    ).select("id");
    if (!claimed?.length) continue;

    try {
      const transfer = await omise<OmiseTransfer>(
        "/transfers",
        new URLSearchParams({ amount: String(payout * 100), recipient: account.omise_recipient_id }),
        { "Idempotency-Key": `payout-${order.id}` },
      );
      if (transfer.failure_code) throw new Error(`omise ${transfer.failure_code}`);
      await supabase
        .from("orders")
        .update({ payout_status: "sent", omise_transfer_id: transfer.id, paid_out_at: new Date(now).toISOString(), payout_error: null })
        .eq("id", order.id);
      processed++;
    } catch (e) {
      console.error("[payout] transfer failed", order.id, (e as Error).message);
      await supabase
        .from("orders")
        .update({ payout_status: "pending", payout_error: (e as Error).message.slice(0, 200) })
        .eq("id", order.id);
    }
  }
  return { processed };
}
