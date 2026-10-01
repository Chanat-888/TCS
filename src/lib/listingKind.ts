import type { Listing } from "@/lib/supabase/types";

type PricedListing = Pick<Listing, "buy_now_price" | "start_price" | "current_price">;

// Omise will not create a PromptPay or TrueMoney charge below ฿20, so no price can go lower.
export const MIN_PRICE = 20;

export const DEFAULT_BID_INCREMENT = 100;

export function bidIncrementOf(listing: Pick<Listing, "bid_increment">) {
  return listing.bid_increment ?? DEFAULT_BID_INCREMENT;
}

// The seller's choice of anti-snipe window/extension, in seconds. 0 means off
// (a hard deadline). A bid landing within this many seconds of closing pushes
// ends_at out by the same amount, repeating until a bid-free window passes.
export const DEFAULT_ANTI_SNIPE_SECONDS = 120;
export const ANTI_SNIPE_PRESETS_SECONDS = [0, 60, 120, 300, 600] as const;

export function antiSnipeSecondsOf(listing: Pick<Listing, "anti_snipe_seconds">) {
  return listing.anti_snipe_seconds ?? DEFAULT_ANTI_SNIPE_SECONDS;
}

/** "2 นาที" / "5 นาที" — all current presets are whole minutes. */
export function formatAntiSnipeDuration(seconds: number) {
  return seconds % 60 === 0 ? `${seconds / 60} นาที` : `${seconds} วินาที`;
}

/** A plain fixed-price listing: the buy-now price is the start price, so there is nothing to bid on. */
export function isFixedPrice(listing: Pick<Listing, "buy_now_price" | "start_price">) {
  return listing.buy_now_price != null && listing.buy_now_price <= listing.start_price;
}

/** A spread post: one photo, many separately purchasable cards. It is never bid on or bought whole. */
export function isSpread(listing: Pick<Listing, "post_kind">) {
  return listing.post_kind === "spread";
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
