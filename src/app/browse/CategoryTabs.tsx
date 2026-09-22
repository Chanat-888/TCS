"use client";

import { useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { WantedPostCard } from "@/components/WantedPostCard";
import type { ListingWithSeller } from "@/lib/queries";
import type { WantedPostWithPoster } from "@/lib/wantedPosts";

const TABS = [
  { key: "all", label: "ทั้งหมด", icon: "grid" },
  { key: "new", label: "บูสเตอร์ใหม่", icon: "gift" },
  { key: "deck", label: "เด็คพร้อมเล่น", icon: "layers" },
  { key: "rare", label: "การ์ดหายาก", icon: "star" },
  { key: "closing", label: "ใกล้ปิดประมูล", icon: "clock" },
] as const;

function TabIcon({ name }: { name: (typeof TABS)[number]["icon"] }) {
  const props = {
    width: 22,
    height: 22,
    viewBox: "0 0 20 20",
    fill: "none" as const,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "grid":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11" y="3" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="3" y="11" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11" y="11" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "gift":
      return (
        <svg {...props}>
          <rect x="3" y="8" width="14" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 8h14v3H3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M10 8v9" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M10 8C10 8 7 8 6.2 6.6A2 2 0 118 3.8C9.4 4.6 10 8 10 8zM10 8c0 0 3 0 3.8-1.4a2 2 0 10-1.8-2.8C10.6 4.6 10 8 10 8z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "layers":
      return (
        <svg {...props}>
          <path d="M10 3l7 3.6-7 3.6-7-3.6L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M3 10.6l7 3.6 7-3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 14.2l7 3.6 7-3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "star":
      return (
        <svg {...props}>
          <path
            d="M10 2.8l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7L10 2.8z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "clock":
      return (
        <svg {...props}>
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 6v4.2l3 1.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function CategoryTabs({
  listings,
  salesCounts,
  wantedPosts,
  initialType,
  initialCategory,
}: {
  listings: ListingWithSeller[];
  salesCounts: Record<string, number>;
  wantedPosts?: WantedPostWithPoster[];
  initialType?: string;
  initialCategory?: string;
}) {
  const isWanted = initialType === "wanted";
  const validCategory = TABS.some((t) => t.key === initialCategory);
  const [active, setActive] = useState<(typeof TABS)[number]["key"]>(
    validCategory ? (initialCategory as (typeof TABS)[number]["key"]) : "all"
  );

  const byType = listings.filter((l) => {
    if (initialType === "auction") return l.buy_now_price == null;
    if (initialType === "product") return l.buy_now_price != null;
    return true;
  });

  const visible = byType.filter((l) => {
    if (active === "all") return true;
    if (active === "closing") return l.buy_now_price == null;
    return l.category === active;
  });

  const visibleWanted = (wantedPosts ?? []).filter((p) => active === "all" || active === "closing" || p.category === active);

  return (
    <>
      <nav
        style={{
          background: "linear-gradient(90deg, rgba(25, 40, 66, 0.95) 0%, rgba(10, 12, 16, 0.92) 50%, rgba(30, 48, 74, 0.95) 100%)",
        }}
        aria-label="หมวดหมู่การ์ด"
      >
        <div className="wrap">
          <div className="flex gap-1 overflow-x-auto py-4" style={{ scrollbarWidth: "none" }}>
            {TABS.map((tab) => {
              const isActive = tab.key === active;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActive(tab.key)}
                  className="flex flex-shrink-0 flex-col items-center gap-2 whitespace-nowrap px-3 py-1 transition-all"
                  style={{ color: isActive ? "var(--blue)" : "var(--steel)" }}
                >
                  <span
                    className="flex items-center justify-center rounded-full transition-all"
                    style={{
                      width: 52,
                      height: 52,
                      background: isActive ? "rgba(58, 138, 255, 0.15)" : "var(--panel)",
                      border: isActive ? "1px solid var(--blue)" : "1px solid rgba(140, 147, 163, 0.2)",
                      color: isActive ? "var(--blue)" : "var(--steel)",
                    }}
                  >
                    <TabIcon name={tab.icon} />
                  </span>
                  <span className="text-[12.5px] font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <section className="pb-20 pt-11">
        <div className="wrap">
          <div className="mb-[22px] flex items-baseline justify-between gap-4">
            <h2 className="text-[1.3rem]">{isWanted ? "ประกาศหาการ์ด" : "การ์ดที่เปิดขาย"}</h2>
            <span className="mono text-[12.5px]" style={{ color: "var(--steel)" }}>
              {(isWanted ? visibleWanted.length : visible.length)} รายการ
            </span>
          </div>

          {isWanted ? (
            visibleWanted.length === 0 ? (
              <p className="py-[60px] text-center text-[14px]" style={{ color: "var(--steel)" }}>
                ไม่มีประกาศหาในหมวดนี้ตอนนี้
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-[18px] max-[1024px]:grid-cols-3 max-[720px]:grid-cols-2 max-[720px]:gap-3">
                {visibleWanted.map((post) => (
                  <WantedPostCard key={post.id} post={post} poster={post.poster} />
                ))}
              </div>
            )
          ) : visible.length === 0 ? (
            <p className="py-[60px] text-center text-[14px]" style={{ color: "var(--steel)" }}>
              ไม่มีการ์ดในหมวดนี้ตอนนี้
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-[18px] max-[1024px]:grid-cols-3 max-[720px]:grid-cols-2 max-[720px]:gap-3">
              {visible.map((listing) => (
                <ProductCard
                  key={listing.id}
                  listing={listing}
                  seller={listing.seller}
                  salesCount={salesCounts[listing.seller_id]}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
