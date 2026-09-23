import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { maskUserLabel } from "@/lib/format";
import type { DisputeDecision, DisputeReason } from "@/lib/supabase/types";

/** The only gate for every /admin page and query below — never trust a
 * client-supplied flag, always re-read is_admin from the database. */
export async function isAdmin(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const supabase = createServiceClient();
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  return data?.is_admin ?? false;
}

const OPEN_ORDER_STATUSES = ["PENDING_PAYMENT", "PAID_HELD", "SHIPPED", "DELIVERED", "DISPUTED"] as const;

export interface AdminDisputeListItem {
  id: string;
  orderCode: string;
  reason: DisputeReason;
  amount: number;
  buyerMask: string;
  sellerName: string;
  createdAt: string;
  decision: DisputeDecision | null;
  decidedAt: string | null;
}

export interface AdminOverview {
  openDisputesCount: number;
  openOrdersCount: number;
  activeListingsCount: number;
  totalUsers: number;
  disputes: AdminDisputeListItem[];
}

// Caller must have already checked isAdmin(viewerId) — this has no gate of
// its own, matching every other query in this file.
export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = createServiceClient();

  const [{ count: openDisputesCount }, { count: openOrdersCount }, { count: activeListingsCount }, { count: totalUsers }, { data: rows }] =
    await Promise.all([
      supabase.from("disputes").select("id", { count: "exact", head: true }).is("decision", null),
      supabase.from("orders").select("id", { count: "exact", head: true }).in("status", OPEN_ORDER_STATUSES),
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("disputes")
        .select("id, reason, decision, decided_at, created_at, order:orders!inner(order_code, amount, buyer_id, seller_id)")
        .order("decision", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  type Row = {
    id: string;
    reason: DisputeReason;
    decision: DisputeDecision | null;
    decided_at: string | null;
    created_at: string;
    order: { order_code: string; amount: number; buyer_id: string; seller_id: string } | null;
  };
  const disputeRows = (rows ?? []) as unknown as Row[];

  const sellerIds = [...new Set(disputeRows.map((r) => r.order?.seller_id).filter((id): id is string => Boolean(id)))];
  const { data: sellers } = sellerIds.length ? await supabase.from("profiles").select("id, display_name").in("id", sellerIds) : { data: [] };
  const sellerNameById = new Map((sellers ?? []).map((s) => [s.id, s.display_name]));

  const disputes: AdminDisputeListItem[] = disputeRows
    .filter((r): r is Row & { order: NonNullable<Row["order"]> } => r.order !== null)
    .map((r) => ({
      id: r.id,
      orderCode: r.order.order_code,
      reason: r.reason,
      amount: r.order.amount,
      buyerMask: maskUserLabel(r.order.buyer_id),
      sellerName: sellerNameById.get(r.order.seller_id) ?? "",
      createdAt: r.created_at,
      decision: r.decision,
      decidedAt: r.decided_at,
    }));

  return {
    openDisputesCount: openDisputesCount ?? 0,
    openOrdersCount: openOrdersCount ?? 0,
    activeListingsCount: activeListingsCount ?? 0,
    totalUsers: totalUsers ?? 0,
    disputes,
  };
}
