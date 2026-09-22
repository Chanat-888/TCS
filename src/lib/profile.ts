import "server-only";
import { getProfile, getCompletedSales, getReviewsForSeller, getListingsBySeller, hasEverBid } from "@/lib/queries";
import { getWantedPostsByPoster } from "@/lib/wantedPosts";

export type ProfileData = Awaited<ReturnType<typeof loadProfileData>>;

/** Everything on a profile that any signed-in visitor may see. It does not
 * depend on who is looking, so callers start it while the session is still
 * being verified. Owner-only data (dispute count) is loaded separately. */
export async function loadProfileData(id: string) {
  const [profile, completedSales, reviews, listings, everBid, wantedPosts] = await Promise.all([
    getProfile(id),
    getCompletedSales(id),
    getReviewsForSeller(id),
    getListingsBySeller(id, { status: "active" }),
    hasEverBid(id),
    getWantedPostsByPoster(id),
  ]);
  const reviewCount = reviews.length;
  return {
    profile, reviews, listings, everBid, wantedPosts,
    stats: {
      completedSales,
      reviewCount,
      avgRating: reviewCount ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount : 0,
    },
  };
}
