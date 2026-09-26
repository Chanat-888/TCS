import { createServiceClient } from "@/lib/supabase/server";
import type { ShipProposal } from "@/lib/supabase/types";

/** Proposal history for one order, newest first. Callers must already have
 * confirmed the viewer is a party to (or an admin of) the order. */
export async function getShipProposals(orderId: string): Promise<ShipProposal[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("order_ship_proposals")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(20);
  // Before migration 0019 the table doesn't exist: show the order without the panel data.
  if (error) return [];
  return (data ?? []) as ShipProposal[];
}
