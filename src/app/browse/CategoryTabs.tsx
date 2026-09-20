"use client";

import { useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import type { ListingWithSeller } from "@/lib/queries";

const TABS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "new", label: "บูสเตอร์ใหม่" },
  { key: "deck", label: "เด็คพร้อมเล่น" },
  { key: "rare", label: "การ์ดหายาก" },
  { key: "closing", label: "ใกล้ปิดประมูล" },
] as const;

export function CategoryTabs({
  listings,
  salesCounts,
  initialType,
  initialCategory,
}: {
  listings: ListingWithSeller[];
  salesCounts: Record<string, number>;
  initialType?: string;
  initialCategory?: string;
}) {
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

  return (
    <>
      <nav
        style={{
          background: "linear-gradient(90deg, rgba(25, 40, 66, 0.95) 0%, rgba(10, 12, 16, 0.92) 50%, rgba(30, 48, 74, 0.95) 100%)",
        }}
        aria-label="หมวดหมู่การ์ด"
      >
        <div className="wrap">
          <div className="flex gap-2 overflow-x-auto py-3" style={{ scrollbarWidth: "none" }}>
            {TABS.map((tab) => {
              const isActive = tab.key === active;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActive(tab.key)}
                  className="flex-shrink-0 whitespace-nowrap rounded-full px-4 py-[9px] text-[13.5px] font-medium transition-all"
                  style={
                    isActive
                      ? { background: "var(--blue)", border: "1px solid var(--blue)", color: "#071523" }
                      : { background: "transparent", border: "1px solid rgba(140, 147, 163, 0.2)", color: "var(--steel)" }
                  }
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <section className="pb-20 pt-11">
        <div className="wrap">
          <div className="mb-[22px] flex items-baseline justify-between gap-4">
            <h2 className="text-[1.3rem]">การ์ดที่เปิดขาย</h2>
            <span className="mono text-[12.5px]" style={{ color: "var(--steel)" }}>
              {visible.length} รายการ
            </span>
          </div>

          {visible.length === 0 ? (
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
