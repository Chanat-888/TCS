import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUserId } from "@/lib/session";
import { getActiveListings, getSellerSalesCountMap } from "@/lib/queries";
import { Brand } from "@/components/Brand";
import { Countdown } from "@/components/Countdown";
import { secondsUntil } from "@/lib/countdown";
import { Footer } from "@/components/Footer";
import { formatTHB } from "@/lib/format";
import { CategoryTabs } from "./CategoryTabs";

export default async function BrowsePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const listings = await getActiveListings();
  const salesCounts = await getSellerSalesCountMap(listings.map((l) => l.seller_id));

  // eslint-disable-next-line react-hooks/purity -- server component, runs once per request
  const now = Date.now();
  const featured =
    listings
      .filter((l) => l.buy_now_price == null && new Date(l.ends_at).getTime() > now)
      .sort((a, b) => b.current_price - a.current_price)[0] ?? listings[0];

  return (
    <div style={{ "--wrap-max": "1240px", "--wrap-pad": "24px", "--wrap-pad-sm": "16px" } as CSSProperties}>
      <header
        className="sticky top-0 z-50"
        style={{
          background: "rgba(10, 12, 16, 0.78)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(140, 147, 163, 0.1)",
        }}
      >
        <div className="wrap flex items-center gap-5 py-[14px]">
          <Brand />
          <label
            className="flex flex-1 items-center gap-[10px] rounded-xl px-[14px] transition-colors"
            style={{ background: "var(--panel)", border: "1px solid rgba(140, 147, 163, 0.2)", height: 46 }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: "var(--steel)", flexShrink: 0 }}>
              <circle cx="9" cy="9" r="6.2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M17 17 L13.6 13.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="ค้นหาการ์ด ชื่อชุด หรือร้านค้า"
              aria-label="ค้นหาการ์ด ชื่อชุด หรือร้านค้า"
              className="flex-1 bg-transparent border-0 outline-none text-[15px]"
              style={{ color: "var(--white)" }}
            />
          </label>
          <button
            type="button"
            aria-label="ตัวกรอง"
            className="flex flex-shrink-0 items-center justify-center rounded-xl"
            style={{ width: 46, height: 46, background: "var(--panel)", border: "1px solid rgba(140, 147, 163, 0.2)", color: "var(--steel)" }}
          >
            <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 5h14M6 10h8M8.5 15h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <main>
        {featured && (
          <section className="pb-2 pt-8">
            <div className="wrap">
              <div
                className="relative grid gap-8 overflow-hidden rounded-[20px] p-10 max-[800px]:grid-cols-1 max-[800px]:gap-6 max-[800px]:p-[28px_22px]"
                style={{
                  gridTemplateColumns: "1.2fr 0.8fr",
                  alignItems: "center",
                  background: "linear-gradient(120deg, #0D1420 0%, #0A0C10 60%)",
                  border: "1px solid rgba(95, 212, 255, 0.18)",
                }}
              >
                <svg
                  className="pointer-events-none absolute inset-0 opacity-50"
                  viewBox="0 0 900 320"
                  preserveAspectRatio="xMidYMid slice"
                  aria-hidden="true"
                >
                  <g stroke="var(--cyan)" strokeWidth={1} opacity={0.35} fill="none">
                    <circle cx="760" cy="160" r="90" />
                    <circle cx="760" cy="160" r="130" />
                    <path d="M760 40 L760 10 M760 280 L760 310 M630 160 L600 160" />
                  </g>
                </svg>
                <div className="relative z-[1]">
                  <h2 className="max-w-[16ch] text-[clamp(1.5rem,3vw,2.1rem)] leading-tight">
                    {featured.name} — ประมูลเด่นประจำสัปดาห์
                  </h2>
                  <div className="mono mt-4 flex flex-wrap items-center gap-[18px] text-[13px]">
                    <span style={{ color: "var(--white)", fontSize: 16 }}>
                      <span style={{ color: "var(--steel)", fontSize: 12, fontFamily: "var(--font-body)", marginRight: 6 }}>
                        ราคาปัจจุบัน
                      </span>
                      {formatTHB(featured.current_price)}
                    </span>
                    <span className="flex items-center gap-[7px]" style={{ color: "var(--cyan)" }}>
                      <span
                        className="rounded-full"
                        style={{ width: 6, height: 6, background: "var(--cyan)", boxShadow: "0 0 8px 1px var(--cyan)" }}
                        aria-hidden="true"
                      />
                      <span>
                        ปิดใน <Countdown endsAt={featured.ends_at} initialSeconds={secondsUntil(featured.ends_at)} />
                      </span>
                    </span>
                  </div>
                  <p className="mt-[18px] max-w-[40ch] text-[13.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
                    เงินอยู่กับ <strong style={{ color: "var(--white)", fontWeight: 500 }}>TCS</strong> จนกว่าคุณจะกดรับการ์ด
                    ไม่พอใจ ได้เงินคืน — ทุกการประมูลผ่านระบบพักเงินเดียวกัน
                  </p>
                  <Link
                    href={`/listings/${featured.id}`}
                    className="mt-[22px] inline-flex items-center gap-2 rounded-[10px] px-[22px] py-3 text-[14.5px] font-semibold no-underline"
                    style={{ background: "var(--blue)", color: "#071523" }}
                  >
                    ดูประมูลนี้
                    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </div>
                <div className="relative z-[1] flex items-center justify-center">
                  <div
                    className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl"
                    style={{
                      width: 168,
                      height: 234,
                      background: "var(--panel-2)",
                      border: "1.5px solid rgba(95, 212, 255, 0.4)",
                      boxShadow: "0 24px 50px -18px rgba(47, 143, 232, 0.4)",
                    }}
                  >
                    <span
                      className="mono absolute right-[10px] top-[10px] rounded-full px-[7px] py-[2px] text-[10px]"
                      style={{ color: "var(--cyan)", background: "rgba(95, 212, 255, 0.1)", border: "1px solid rgba(95, 212, 255, 0.3)" }}
                    >
                      {featured.rarity}
                    </span>
                    <svg width="30%" height="30%" viewBox="0 0 64 64" aria-hidden="true">
                      <path d="M32 6 L40.8 25.2 L32 44.4 L23.2 25.2 Z" fill="var(--cyan)" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        <CategoryTabs listings={listings} salesCounts={salesCounts} />
      </main>

      <Footer note="เอกสารแนวคิดฉบับพรีวิว — ข้อมูลสินค้าเป็นตัวอย่างประกอบการออกแบบ ไม่ใช่รายการขายจริง" />
    </div>
  );
}
