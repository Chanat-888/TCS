import type { Listing } from "@/lib/supabase/types";

type PricedListing = Pick<Listing, "buy_now_price" | "start_price" | "current_price">;

export function hasBids(listing: Pick<Listing, "start_price" | "current_price">) {
  return listing.current_price > listing.start_price;
}

/**
 * A listing offers "buy now" only until the first bid lands (eBay-style). After
 * that it is a plain auction, so browse, the listing page and the server all
 * agree on which state a listing is in.
 */
export function isBuyNowAvailable(listing: PricedListing) {
  return listing.buy_now_price != null && !hasBids(listing);
}

export function isAuction(listing: PricedListing) {
  return !isBuyNowAvailable(listing);
}
