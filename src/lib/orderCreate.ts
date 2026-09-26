import type { createServiceClient } from "@/lib/supabase/server";

/** Winners and buy-now buyers have 24 hours to pay before the order is auto-cancelled. */
export const PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

function generateOrderCode() {
  const now = new Date();
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const suffix = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `TCS-${yy}${mm}${dd}-${suffix}`;
}

/** A new order waiting for the buyer's payment. Shared by bidding, buy-now, end-early and the timers. */
export function createPendingOrder(
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
      payment_deadline_at: new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString(),
    })
    .select()
    .single();
}
