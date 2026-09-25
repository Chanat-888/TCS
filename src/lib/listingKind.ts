import type { Listing } from "@/lib/supabase/types";

type PricedListing = Pick<Listing, "buy_now_price" | "start_price" | "current_price">;

export const DEFAULT_BID_INCREMENT = 100;

export function bidIncrementOf(listing: Pick<Listing, "bid_increment">) {
  return listing.bid_increment ?? DEFAULT_BID_INCREMENT;
}

/** A plain fixed-price listing: the buy-now price is the start price, so there is nothing to bid on. */
export function isFixedPrice(listing: Pick<Listing, "buy_now_price" | "start_price">) {
  return listing.buy_now_price != null && listing.buy_now_price <= listing.start_price;
}

export function hasBids(listing: Pick<Listing, "start_price" | "current_price">) {
  return listing.current_price > listing.start_price;
}

/** Buy-now can still be pressed: unbid, and there is room above the start price to bid instead. */
export function isBuyNowAvailable(listing: PricedListing) {
  return listing.buy_now_price != null && !hasBids(listing);
}

/**
 * "Auction" vs "product" for browse: anything that is not a plain fixed-price
 * listing. An auction with an instant-win price is still an auction from the
 * moment it is listed, not only after its first bid.
 */
export function isAuction(listing: Pick<Listing, "buy_now_price" | "start_price">) {
  return !isFixedPrice(listing);
}
