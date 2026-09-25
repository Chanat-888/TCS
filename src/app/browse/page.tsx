import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { getActiveListings, getProfile, getSellerSalesCountMap } from "@/lib/queries";
import { DEFAULT_DISPLAY_NAME } from "@/lib/profileName";
import { isAuction } from "@/lib/listingKind";
import { getActiveWantedPosts } from "@/lib/wantedPosts";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CategoryTabs } from "./CategoryTabs";
import { FeaturedCarousel, WelcomeBanner } from "./FeaturedCarousel";

const MAX_FEATURED_SLIDES = 5;

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; category?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { type, category } = await searchParams;

  const listings = await getActiveListings();
  const salesCounts = await getSellerSalesCountMap(listings.map((l) => l.seller_id));
  const wantedPosts = type === "wanted" ? await getActiveWantedPosts() : [];

  // eslint-disable-next-line react-hooks/purity -- server component, runs once per request
  const now = Date.now();
  const openAuctions = listings
    .filter((l) => isAuction(l) && new Date(l.ends_at).getTime() > now)
    .sort((a, b) => b.current_price - a.current_price);
  const featuredList = type ? [] : (openAuctions.length > 0 ? openAuctions : listings).slice(0, MAX_FEATURED_SLIDES);
  // Nothing to feature on the home view: greet the user in the banner slot instead of leaving it empty.
  const welcome = !type && featuredList.length === 0;
  const viewerName = welcome ? ((await getProfile(userId))?.display_name ?? DEFAULT_DISPLAY_NAME) : "";

  return (
    <div style={{ "--wrap-max": "1240px", "--wrap-pad": "24px", "--wrap-pad-sm": "16px" } as CSSProperties}>
      <SiteHeader userId={userId} />

      <main>
        <h1 className="sr-only">TCS ตลาดซื้อขายการ์ด</h1>
        {welcome ? <WelcomeBanner name={viewerName} /> : <FeaturedCarousel listings={featuredList} />}

        <CategoryTabs
          key={`${type ?? "all"}-${category ?? "all"}`}
          listings={listings}
          salesCounts={salesCounts}
          wantedPosts={wantedPosts}
          initialType={type}
          initialCategory={category}
        />
      </main>

      <Footer />
    </div>
  );
}
