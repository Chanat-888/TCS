import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { getActiveListings, getSellerSalesCountMap } from "@/lib/queries";
import { isAuction } from "@/lib/listingKind";
import { getActiveWantedPosts } from "@/lib/wantedPosts";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CategoryTabs } from "./CategoryTabs";
import { FeaturedCarousel } from "./FeaturedCarousel";

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

  return (
    <div style={{ "--wrap-max": "1240px", "--wrap-pad": "24px", "--wrap-pad-sm": "16px" } as CSSProperties}>
      <SiteHeader userId={userId} />

      <main>
        <FeaturedCarousel listings={featuredList} />

        <CategoryTabs
          key={`${type ?? "all"}-${category ?? "all"}`}
          listings={listings}
          salesCounts={salesCounts}
          wantedPosts={wantedPosts}
          initialType={type}
          initialCategory={category}
        />
      </main>

      <Footer note="เอกสารแนวคิดฉบับพรีวิว — ข้อมูลสินค้าเป็นตัวอย่างประกอบการออกแบบ ไม่ใช่รายการขายจริง" />
    </div>
  );
}
