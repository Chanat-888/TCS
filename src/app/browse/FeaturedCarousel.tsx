"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { secondsUntil } from "@/lib/countdown";
import { formatTHB } from "@/lib/format";
import type { ListingWithSeller } from "@/lib/queries";

const SLIDE_SECONDS = 5;

export function FeaturedCarousel({ listings }: { listings: ListingWithSeller[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (listings.length < 2) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % listings.length);
    }, SLIDE_SECONDS * 1000);
    return () => clearInterval(id);
  }, [index, listings.length]);

  const featured = listings[Math.min(index, listings.length - 1)];
  if (!featured) return null;

  const goPrev = () => setIndex((i) => (i - 1 + listings.length) % listings.length);
  const goNext = () => setIndex((i) => (i + 1) % listings.length);

  return (
    <section className="pb-2 pt-5">
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

          <div key={featured.id} className="relative z-[1]" style={{ animation: "featured-slide-in 0.5s var(--ease)" }}>
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

          <div
            key={`${featured.id}-art`}
            className="relative z-[1] flex items-center justify-center"
            style={{ animation: "featured-slide-in 0.5s var(--ease)" }}
          >
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
                className="mono absolute right-[10px] top-[10px] z-[1] rounded-full px-[7px] py-[2px] text-[10px]"
                style={{ color: "var(--cyan)", background: "rgba(95, 212, 255, 0.1)", border: "1px solid rgba(95, 212, 255, 0.3)" }}
              >
                {featured.rarity}
              </span>
              {featured.photo_front_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={featured.photo_front_url}
                  alt={featured.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <svg width="30%" height="30%" viewBox="0 0 64 64" aria-hidden="true">
                  <path d="M32 6 L40.8 25.2 L32 44.4 L23.2 25.2 Z" fill="var(--cyan)" />
                </svg>
              )}
            </div>
          </div>

          {listings.length > 1 && (
            <div className="absolute bottom-4 left-1/2 z-[2] flex -translate-x-1/2 items-center gap-3">
              <button
                type="button"
                aria-label="สไลด์ก่อนหน้า"
                onClick={goPrev}
                className="flex flex-shrink-0 items-center justify-center rounded-full"
                style={{
                  width: 26,
                  height: 26,
                  background: "rgba(10, 12, 16, 0.55)",
                  border: "1px solid rgba(255, 255, 255, 0.16)",
                  color: "var(--white)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M12.5 5 L7 10 L12.5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div className="flex items-center gap-[6px]">
                {listings.map((l, i) => (
                  <button
                    key={l.id}
                    type="button"
                    aria-label={`ไปที่สไลด์ ${i + 1}`}
                    onClick={() => setIndex(i)}
                    className="rounded-full transition-all"
                    style={{
                      width: i === index ? 18 : 6,
                      height: 6,
                      background: i === index ? "var(--blue)" : "rgba(140, 147, 163, 0.35)",
                    }}
                  />
                ))}
              </div>

              <button
                type="button"
                aria-label="สไลด์ถัดไป"
                onClick={goNext}
                className="flex flex-shrink-0 items-center justify-center rounded-full"
                style={{
                  width: 26,
                  height: 26,
                  background: "rgba(10, 12, 16, 0.55)",
                  border: "1px solid rgba(255, 255, 255, 0.16)",
                  color: "var(--white)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M7.5 5 L13 10 L7.5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
