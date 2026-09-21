import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { Listing, Order, OrderStatus, Profile } from "@/lib/supabase/types";

/** Owner-only stat (orders/disputes aren't publicly readable) — only call
 * this after confirming the caller is viewing their own profile. */
export async function getOwnerDisputeCount(userId: string): Promise<number> {
  try {
    const supabase = createServiceClient();
    const { count } = await supabase
      .from("disputes")
      .select("id, order:orders!inner(seller_id)", { count: "exact", head: true })
      .eq("order.seller_id", userId);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export interface OrderDetail {
  order: Order;
  listing: Listing;
  buyer: Profile;
  seller: Profile;
  isBuyer: boolean;
  isSeller: boolean;
  isAdmin: boolean;
}

/** Loads an order plus its listing/buyer/seller, only for a participant
 * (buyer, seller) or an admin — everyone else gets null (treat as 404). */
export async function getOrderDetail(orderId: string, userId: string): Promise<OrderDetail | null> {
  const supabase = createServiceClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return null;

  const { data: viewer } = await supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  const isBuyer = order.buyer_id === userId;
  const isSeller = order.seller_id === userId;
  const isAdmin = viewer?.is_admin ?? false;
  if (!isBuyer && !isSeller && !isAdmin) return null;

  const [{ data: listing }, { data: buyer }, { data: seller }] = await Promise.all([
    supabase.from("listings").select("*").eq("id", order.listing_id).single(),
    supabase.from("profiles").select("*").eq("id", order.buyer_id).single(),
    supabase.from("profiles").select("*").eq("id", order.seller_id).single(),
  ]);

  return { order: order as Order, listing: listing as Listing, buyer: buyer as Profile, seller: seller as Profile, isBuyer, isSeller, isAdmin };
}

export interface DisputeDetail {
  dispute: import("@/lib/supabase/types").Dispute;
  order: Order;
  listing: Listing;
  buyer: Profile;
  seller: Profile;
}

export async function getDisputeDetail(disputeId: string, viewerId: string): Promise<DisputeDetail | null> {
  const supabase = createServiceClient();
  const { data: viewer } = await supabase.from("profiles").select("is_admin").eq("id", viewerId).maybeSingle();
  if (!viewer?.is_admin) return null;

  const { data: dispute } = await supabase.from("disputes").select("*").eq("id", disputeId).maybeSingle();
  if (!dispute) return null;

  const { data: order } = await supabase.from("orders").select("*").eq("id", dispute.order_id).single();
  const [{ data: listing }, { data: buyer }, { data: seller }] = await Promise.all([
    supabase.from("listings").select("*").eq("id", order.listing_id).single(),
    supabase.from("profiles").select("*").eq("id", order.buyer_id).single(),
    supabase.from("profiles").select("*").eq("id", order.seller_id).single(),
  ]);

  return { dispute, order: order as Order, listing: listing as Listing, buyer: buyer as Profile, seller: seller as Profile };
}

export interface OrderListItem {
  id: string;
  orderCode: string;
  status: OrderStatus;
  amount: number;
  createdAt: string;
  listingName: string;
  listingPhotoUrl: string | null;
  sellerName: string;
}

/** Orders a buyer can browse back to — the only nav path to /orders/[id]
 * today is the redirect right after checkout, so this backs a real list page. */
export async function getOrdersForBuyer(userId: string): Promise<OrderListItem[]> {
  const supabase = createServiceClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_code, status, amount, created_at, seller_id, listing:listings(name, photo_front_url)")
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false });
  if (!orders || orders.length === 0) return [];

  const sellerIds = [...new Set(orders.map((o) => o.seller_id))];
  const { data: sellers } = await supabase.from("profiles").select("id, display_name").in("id", sellerIds);
  const sellerNameById = new Map((sellers ?? []).map((s) => [s.id, s.display_name]));

  return orders.map((o) => {
    const listing = o.listing as unknown as { name: string; photo_front_url: string | null } | null;
    return {
      id: o.id,
      orderCode: o.order_code,
      status: o.status,
      amount: o.amount,
      createdAt: o.created_at,
      listingName: listing?.name ?? "",
      listingPhotoUrl: listing?.photo_front_url ?? null,
      sellerName: sellerNameById.get(o.seller_id) ?? "",
    };
  });
}

export async function getMessagesForOrder(orderId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase.from("messages").select("*").eq("order_id", orderId).order("created_at", { ascending: true });
  return data ?? [];
}
