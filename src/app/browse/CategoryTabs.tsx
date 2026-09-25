"use client";

import { useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { WantedPostCard } from "@/components/WantedPostCard";
import type { ListingWithSeller } from "@/lib/queries";
import type { WantedPostWithPoster } from "@/lib/wantedPosts";

const PAGE_SIZE = 24;

const TABS = [
  { key: "all", label: "ทั้งหมด", icon: "grid" },
  { key: "new", label: "บูสเตอร์ใหม่", icon: "gift" },
  { key: "deck", label: "เด็คพร้อมเล่น", icon: "layers" },
  { key: "rare", label: "การ์ดหายาก", icon: "star" },
  { key: "closing", label: "ใกล้ปิดประมูล", icon: "clock" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function TabIcon({ name }: { name: (typeof TABS)[number]["icon"] }) {
  const props = {
    width: 17,
    height: 17,
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
  const [shown, setShown] = useState(PAGE_SIZE);
  const isWanted = initialType === "wanted";
  const validCategory = TABS.some((t) => t.key === initialCategory);
  const [active, setActive] = useState<TabKey>(validCategory ? (initialCategory as TabKey) : "all");

  const byType = listings.filter((l) => {
    if (initialType === "auction") return l.buy_now_price == null;
    if (initialType === "product") return l.buy_now_price != null;
    return true;
  });

  const inTab = (key: TabKey) => (l: ListingWithSeller) =>
    key === "all" ? true : key === "closing" ? l.buy_now_price == null : l.category === key;
  const wantedInTab = (key: TabKey) => (p: WantedPostWithPoster) => key === "all" || key === "closing" || p.category === key;

  const visible = byType.filter(inTab(active));
  // "ใกล้ปิดประมูล" means soonest-ending first.
  if (active === "closing") visible.sort((a, b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime());

  const visibleWanted = (wantedPosts ?? []).filter(wantedInTab(active));
  // Wanted posts have no auctions, so the closing tab adds nothing there.
  const tabs = isWanted ? TABS.filter((t) => t.key !== "closing") : TABS;
  const countFor = (key: TabKey) =>
    isWanted ? (wantedPosts ?? []).filter(wantedInTab(key)).length : byType.filter(inTab(key)).length;

  return (
    <>
      <section className="pb-20 pt-10">
        <div className="wrap">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="text-[1.3rem]">{isWanted ? "ประกาศหาการ์ด" : "การ์ดที่เปิดขาย"}</h2>
            <span className="mono text-[12.5px]" style={{ color: "var(--steel)" }}>
              {(isWanted ? visibleWanted.length : visible.length)} รายการ
            </span>
          </div>

          <nav aria-label="หมวดหมู่การ์ด" className="-mx-4 mb-6 px-4" style={{ borderBottom: "1px solid var(--line-soft)" }}>
            <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {tabs.map((tab) => {
                const isActive = tab.key === active;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => { setActive(tab.key); setShown(PAGE_SIZE); }}
                    className="relative flex min-h-12 flex-shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap px-3 text-[13.5px] font-medium transition-colors hover:text-[var(--white)]"
                    style={{ color: isActive ? "var(--white)" : "var(--steel)" }}
                  >
                    <span style={{ color: isActive ? "var(--cyan)" : "currentColor" }}>
                      <TabIcon name={tab.icon} />
                    </span>
                    {tab.label}
                    <span
                      className="mono rounded-full px-[7px] py-[1px] text-[11px]"
                      style={{
                        background: isActive ? "var(--cyan-tint)" : "var(--line-soft)",
                        color: isActive ? "var(--cyan)" : "var(--steel)",
                      }}
                    >
                      {countFor(tab.key)}
                    </span>
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-2 -bottom-px h-[2px] rounded-full transition-opacity"
                      style={{ background: "var(--cyan)", opacity: isActive ? 1 : 0, boxShadow: "0 0 10px var(--cyan)" }}
                    />
                  </button>
                );
              })}
            </div>
          </nav>

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
              {visible.slice(0, shown).map((listing) => (
                <ProductCard
                  key={listing.id}
                  listing={listing}
                  seller={listing.seller}
                  salesCount={salesCounts[listing.seller_id]}
                />
              ))}
            </div>
          )}
          {!isWanted && visible.length > shown && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE_SIZE)}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-6 text-[13.5px] font-medium transition-colors hover:border-[var(--cyan-line)] hover:text-[var(--cyan)]"
                style={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--steel)" }}
              >
                แสดงเพิ่ม ({visible.length - shown})
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
