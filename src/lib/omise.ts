import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

export interface OmiseCharge {
  id: string;
  status: "pending" | "successful" | "failed" | "expired" | "reversed";
  amount: number;
  currency: string;
  metadata?: { order_id?: string };
  authorize_uri?: string | null;
  source?: { scannable_code?: { image?: { download_uri?: string } } } | null;
}

// Test vs live is decided by the key alone: skey_test_… charges no real money.
export async function omise(path: string, body?: URLSearchParams): Promise<OmiseCharge> {
  const res = await fetch(`https://api.omise.co${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: "Basic " + Buffer.from(`${process.env.OMISE_SECRET_KEY}:`).toString("base64") },
    body,
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || json.object === "error") throw new Error(`omise ${json.code ?? res.status}`);
  return json;
}

// The only path to PAID_HELD. The charge is always re-read from Omise, so a forged
// webhook body or client call can't mark an order paid.
export async function syncCharge(chargeId: string): Promise<OmiseCharge["status"]> {
  const charge = await omise(`/charges/${encodeURIComponent(chargeId)}`);
  const orderId = charge.metadata?.order_id;
  if (charge.status !== "successful" || !orderId || charge.currency.toLowerCase() !== "thb") return charge.status;

  const { data, error } = await createServiceClient()
    .from("orders")
    .update({ status: "PAID_HELD", paid_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "PENDING_PAYMENT")
    .eq("amount", charge.amount / 100)
    .select("id");
  if (error) throw error;
  // ponytail: no auto-refund yet. A paid charge for an already-paid, cancelled or
  // re-priced order is only logged; refund it by hand in the Omise dashboard.
  if (!data?.length) console.error("[omise] successful charge matched no payable order", charge.id, orderId);
  return charge.status;
}
