import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { searchListings, getSellerSalesCountMap } from "@/lib/queries";
import { searchWantedPosts } from "@/lib/wantedPosts";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { WantedPostCard } from "@/components/WantedPostCard";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const [listings, wantedPosts] = query
    ? await Promise.all([searchListings(query), searchWantedPosts(query)])
    : [[], []];
  const salesCounts = await getSellerSalesCountMap(listings.map((l) => l.seller_id));

  return (
    <div style={{ "--wrap-max": "1240px", "--wrap-pad": "24px", "--wrap-pad-sm": "16px" } as CSSProperties}>
      <SiteHeader userId={userId} />

      <main className="pb-20 pt-9">
        <div className="wrap">
          <form action="/search" method="get" className="mx-auto max-w-[520px]">
            <div className="relative">
              <span className="pointer-events-none absolute left-[15px] top-1/2 -translate-y-1/2" style={{ color: "var(--steel)" }}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <circle cx="9" cy="9" r="6.2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M17 17 L13.6 13.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <input
                name="q"
                defaultValue={query}
                placeholder="ค้นหาการ์ด ชื่อ หรือชุด"
                autoFocus
                className="h-[50px] w-full rounded-full pl-[44px] pr-5 text-[15px] outline-none"
                style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--white)" }}
              />
            </div>
          </form>

          {query === "" ? (
            <p className="mt-[60px] text-center text-[14px]" style={{ color: "var(--steel)" }}>
              พิมพ์ชื่อการ์ดหรือชุดที่ต้องการค้นหา
            </p>
          ) : (
            <>
              <section className="mt-10">
                <div className="mb-[18px] flex items-baseline justify-between gap-3">
                  <h2 className="text-[1.15rem]">
                    ผลการค้นหา &ldquo;{query}&rdquo;
                  </h2>
                  <span className="mono text-[12.5px]" style={{ color: "var(--steel)" }}>
                    {listings.length} รายการ
                  </span>
                </div>
                {listings.length === 0 ? (
                  <p className="py-[40px] text-center text-[14px]" style={{ color: "var(--steel)" }}>
                    ไม่พบการ์ดที่ตรงกับคำค้นหา
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-[18px] max-[1024px]:grid-cols-3 max-[720px]:grid-cols-2 max-[720px]:gap-3">
                    {listings.map((listing) => (
                      <ProductCard key={listing.id} listing={listing} seller={listing.seller} salesCount={salesCounts[listing.seller_id]} />
                    ))}
                  </div>
                )}
              </section>

              {wantedPosts.length > 0 && (
                <section className="mt-10">
                  <div className="mb-[18px] flex items-baseline justify-between gap-3">
                    <h2 className="text-[1.15rem]">ประกาศหาที่เกี่ยวข้อง</h2>
                    <span className="mono text-[12.5px]" style={{ color: "var(--steel)" }}>
                      {wantedPosts.length} รายการ
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-[18px] max-[1024px]:grid-cols-3 max-[720px]:grid-cols-2 max-[720px]:gap-3">
                    {wantedPosts.map((post) => (
                      <WantedPostCard key={post.id} post={post} poster={post.poster} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      <Footer note="เอกสารแนวคิดฉบับพรีวิว — ผลการค้นหาเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
