import { createServiceClient } from "@/lib/supabase/server";
import type { ListingItem } from "@/lib/supabase/types";

// `reserved_by` (who is holding a card) is private, so it is never selected.
const ITEM_COLUMNS = "id, listing_id, position, name, rarity, condition, price, status, order_id";

/** Cards of a spread post, in the order the seller numbered them. */
export async function getListingItems(listingId: string): Promise<ListingItem[]> {
  const { data, error } = await createServiceClient()
    .from("listing_items")
    .select(ITEM_COLUMNS)
    .eq("listing_id", listingId)
    .order("position", { ascending: true });
  // Before migration 0020 the table doesn't exist: treat as "no cards".
  if (error) return [];
  return (data ?? []) as ListingItem[];
}

/** The cards bought in one order (empty for an ordinary single-item order). */
export async function getOrderItems(orderId: string): Promise<ListingItem[]> {
  const { data, error } = await createServiceClient()
    .from("listing_items")
    .select(ITEM_COLUMNS)
    .eq("order_id", orderId)
    .order("position", { ascending: true });
  if (error) return [];
  return (data ?? []) as ListingItem[];
}
