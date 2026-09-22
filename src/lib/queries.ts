import "server-only";
import { createPublicClient } from "@/lib/supabase/server";
import type { Bid, Listing, Profile, Review } from "@/lib/supabase/types";

export type ListingWithSeller = Listing & { seller: Profile };

export async function getActiveListings(): Promise<ListingWithSeller[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*, seller:profiles(*)")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as ListingWithSeller[];
}

/** Matches active listings whose name or set contains `query` (case-insensitive). */
export async function searchListings(query: string): Promise<ListingWithSeller[]> {
  const supabase = createPublicClient();
  const pattern = `%${query.trim()}%`;
  const [byName, bySet] = await Promise.all([
    supabase.from("listings").select("*, seller:profiles(*)").eq("status", "active").ilike("name", pattern).order("created_at", { ascending: false }),
    supabase.from("listings").select("*, seller:profiles(*)").eq("status", "active").ilike("set_name", pattern).order("created_at", { ascending: false }),
  ]);
  if (byName.error) throw byName.error;
  if (bySet.error) throw bySet.error;

  const seen = new Set<string>();
  const merged: ListingWithSeller[] = [];
  for (const row of [...(byName.data ?? []), ...(bySet.data ?? [])] as unknown as ListingWithSeller[]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}

export async function getListingById(id: string): Promise<ListingWithSeller | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*, seller:profiles(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as ListingWithSeller | null;
}

export async function getListingsBySeller(
  sellerId: string,
  opts: { status?: string; excludeId?: string } = {}
): Promise<Listing[]> {
  const supabase = createPublicClient();
  let query = supabase.from("listings").select("*").eq("seller_id", sellerId);
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.excludeId) query = query.neq("id", opts.excludeId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data as Listing[];
}

export async function getBidsForListing(listingId: string): Promise<Bid[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("bids")
    .select("*")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Bid[];
}

export async function getProfile(id: string): Promise<Profile | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export interface SellerStats {
  completedSales: number;
  reviewCount: number;
  avgRating: number;
}

/** Profile pages already fetch reviews, so request only the missing sales total. */
export async function getCompletedSales(sellerId: string): Promise<number> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("seller_public_stats")
    .select("completed_sales")
    .eq("seller_id", sellerId)
    .maybeSingle();
  if (error) throw error;
  return data?.completed_sales ?? 0;
}

/** Public trust stats (seller row on browse/auction/profile). Dispute count
 * is owner-only info — see getOwnerDisputeCount in orders.ts. */
export async function getSellerStats(sellerId: string): Promise<SellerStats> {
  const supabase = createPublicClient();

  const [{ data: statsRow }, { data: reviews }] = await Promise.all([
    supabase.from("seller_public_stats").select("completed_sales").eq("seller_id", sellerId).maybeSingle(),
    supabase.from("reviews").select("rating").eq("ratee_id", sellerId),
  ]);

  const reviewCount = reviews?.length ?? 0;
  const avgRating = reviewCount > 0 ? reviews!.reduce((sum, r) => sum + r.rating, 0) / reviewCount : 0;

  return {
    completedSales: statsRow?.completed_sales ?? 0,
    reviewCount,
    avgRating,
  };
}

export async function getSellerSalesCountMap(sellerIds: string[]): Promise<Record<string, number>> {
  if (sellerIds.length === 0) return {};
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("seller_public_stats")
    .select("seller_id, completed_sales")
    .in("seller_id", Array.from(new Set(sellerIds)));
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.seller_id, r.completed_sales]));
}

export async function hasEverBid(userId: string): Promise<boolean> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("bids")
    .select("id")
    .eq("bidder_id", userId)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export type ReviewWithRater = Review & { rater: Profile };

export async function getReviewsForSeller(sellerId: string): Promise<ReviewWithRater[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*, rater:profiles!reviews_rater_id_fkey(*)")
    .eq("ratee_id", sellerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as ReviewWithRater[];
}
