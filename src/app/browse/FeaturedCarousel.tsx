"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { secondsUntil } from "@/lib/countdown";
import { formatTHB } from "@/lib/format";
import type { ListingWithSeller } from "@/lib/queries";

const SLIDE_SECONDS = 5;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:border-[var(--cyan-line)] hover:text-[var(--cyan)]"
      style={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--steel)" }}
    >
      {children}
    </button>
  );
}

export function FeaturedCarousel({ listings }: { listings: ListingWithSeller[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED_MOTION).matches, () => false);

  const playing = !paused && !hovering && !reducedMotion;

  useEffect(() => {
    if (listings.length < 2 || !playing) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % listings.length);
    }, SLIDE_SECONDS * 1000);
    return () => clearInterval(id);
  }, [index, listings.length, playing]);

  const featured = listings[Math.min(index, listings.length - 1)];
  if (!featured) return null;

  const goPrev = () => setIndex((i) => (i - 1 + listings.length) % listings.length);
  const goNext = () => setIndex((i) => (i + 1) % listings.length);
  const isAuction = featured.buy_now_price == null;
  const price = isAuction ? featured.current_price : featured.buy_now_price!;
  const multiple = listings.length > 1;
  const slideAnimation = reducedMotion ? undefined : "featured-slide-in 0.5s var(--ease)";
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section
      className="pb-2 pt-5"
      aria-roledescription="carousel"
      aria-label="รายการเด่น"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
    >
      <div className="wrap">
        <div
          className="relative grid grid-cols-[1.15fr_0.85fr] items-center gap-10 overflow-hidden rounded-[20px] px-12 py-10 max-[800px]:grid-cols-1 max-[800px]:gap-8 max-[800px]:px-[22px] max-[800px]:py-7"
          style={{
            background:
              "radial-gradient(60% 90% at 78% 50%, color-mix(in srgb, var(--blue) 16%, transparent) 0%, transparent 70%), var(--panel)",
            border: "1px solid var(--line)",
          }}
        >
          {/* Circuit traces, after the card-back engraving. */}
          <svg
            className="pointer-events-none absolute inset-y-0 right-0 h-full w-[55%] max-[800px]:hidden"
            viewBox="0 0 500 360"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <g stroke="var(--cyan)" strokeWidth={1} fill="none" opacity={0.18} strokeLinecap="round">
              <path d="M0 70 H120 L150 100 H250" />
              <path d="M0 290 H90 L130 250 H250" />
              <path d="M500 60 H400 L370 90 H330" />
              <path d="M500 300 H420 L385 265 H330" />
              <path d="M250 0 V40" />
              <path d="M250 360 V320" />
            </g>
            <g fill="var(--cyan)" opacity={0.35}>
              <circle cx="250" cy="100" r="2.5" />
              <circle cx="250" cy="250" r="2.5" />
              <circle cx="330" cy="90" r="2.5" />
              <circle cx="330" cy="265" r="2.5" />
            </g>
          </svg>

          <div
            key={featured.id}
            className="relative z-[1] flex min-w-0 flex-col"
            style={{ animation: slideAnimation }}
            aria-live={playing ? "off" : "polite"}
          >
            <h2
              className="max-w-[20ch] overflow-hidden text-[clamp(1.6rem,3.2vw,2.4rem)] leading-[1.15]"
              style={{ textWrap: "balance", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
            >
              {featured.name}
            </h2>
            {featured.seller && (
              <p className="mt-2 text-[13px]" style={{ color: "var(--steel)" }}>
                ขายโดย <span style={{ color: "var(--white)" }}>{featured.seller.display_name}</span>
              </p>
            )}

            <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
              <div>
                <dt className="text-[12px]" style={{ color: "var(--steel)" }}>
                  {isAuction ? "ราคาประมูลตอนนี้" : "ราคาซื้อทันที"}
                </dt>
                <dd className="mono mt-1 text-[clamp(1.4rem,2.4vw,1.75rem)] leading-none" style={{ color: "var(--white)" }}>
                  {formatTHB(price)}
                </dd>
              </div>
              {isAuction && (
                <div className="pl-8 max-[420px]:pl-0" style={{ borderLeft: "1px solid var(--line)" }}>
                  <dt className="text-[12px]" style={{ color: "var(--steel)" }}>
                    ปิดประมูลใน
                  </dt>
                  <dd className="mono mt-1 text-[clamp(1.4rem,2.4vw,1.75rem)] leading-none" style={{ color: "var(--cyan)" }}>
                    <Countdown endsAt={featured.ends_at} initialSeconds={secondsUntil(featured.ends_at)} />
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link
                href={`/listings/${featured.id}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-[10px] px-[22px] text-[14.5px] font-semibold no-underline transition-[filter] hover:brightness-110"
                style={{ background: "var(--blue)", color: "#071523" }}
              >
                {isAuction ? "เข้าร่วมประมูล" : "ดูสินค้านี้"}
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <p className="flex items-center gap-[7px] text-[12.5px]" style={{ color: "var(--steel)" }}>
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: "var(--cyan)", flexShrink: 0 }}>
                  <path d="M10 2.5 L16 5 V9.5 C16 13.5 13.4 16.4 10 17.5 C6.6 16.4 4 13.5 4 9.5 V5 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  <path d="M7.4 10 L9.3 11.9 L12.8 8.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                เงินอยู่กับ TCS จนกว่าคุณจะกดรับการ์ด
              </p>
            </div>
          </div>

          <div
            key={`${featured.id}-art`}
            className="relative z-[1] flex items-center justify-center py-2"
            style={{ animation: slideAnimation }}
          >
            {/* Fanned pair, like the brand mark: a blank card behind, the listing in front. */}
            <div className="relative" style={{ width: 196, height: 274 }}>
              <div
                aria-hidden="true"
                className="absolute inset-0 rounded-2xl"
                style={{ background: "var(--panel-2)", border: "1px solid var(--blue-dim)", transform: "rotate(8deg) translate(18px, 6px)" }}
              />
              <div
                className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl"
                style={{
                  background: "var(--panel-2)",
                  border: "1.5px solid var(--cyan-line)",
                  boxShadow: "0 30px 60px -22px rgba(47, 143, 232, 0.55)",
                  transform: "rotate(-3deg)",
                }}
              >
                {featured.photo_front_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={featured.photo_front_url} alt={featured.name} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <svg width="30%" height="30%" viewBox="0 0 64 64" aria-hidden="true">
                    <path d="M32 6 L40.8 25.2 L32 44.4 L23.2 25.2 Z" fill="var(--cyan)" />
                  </svg>
                )}
                <span
                  className="mono absolute right-[10px] top-[10px] z-[1] rounded-full px-[7px] py-[2px] text-[10px]"
                  style={{ color: "var(--cyan)", background: "rgba(10, 12, 16, 0.75)", border: "1px solid var(--cyan-line)" }}
                >
                  {featured.rarity}
                </span>
              </div>
            </div>
          </div>

          {multiple && (
            <div className="relative z-[2] col-span-full flex items-center gap-2 max-[800px]:col-span-1">
              <span className="mono mr-2 whitespace-nowrap text-[12.5px]" style={{ color: "var(--steel)" }} aria-hidden="true">
                <span style={{ color: "var(--white)" }}>{pad(index + 1)}</span> / {pad(listings.length)}
              </span>
              <div className="flex flex-1 items-center gap-[6px] max-[480px]:hidden">
                {listings.map((l, i) => (
                  <button
                    key={l.id}
                    type="button"
                    aria-label={`ไปที่สไลด์ ${i + 1}`}
                    aria-current={i === index}
                    onClick={() => setIndex(i)}
                    className="flex h-11 flex-1 cursor-pointer items-center"
                    style={{ maxWidth: 56 }}
                  >
                    <span
                      className="block h-[3px] w-full rounded-full transition-colors"
                      style={{ background: i === index ? "var(--cyan)" : "var(--line)" }}
                    />
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {!reducedMotion && (
                  <ControlButton label={paused ? "เล่นสไลด์อัตโนมัติ" : "หยุดสไลด์อัตโนมัติ"} onClick={() => setPaused((p) => !p)}>
                    <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      {paused ? <path d="M6 3.5 L16 10 L6 16.5 Z" /> : <path d="M5 3.5h3.6v13H5zM11.4 3.5H15v13h-3.6z" />}
                    </svg>
                  </ControlButton>
                )}
                <ControlButton label="สไลด์ก่อนหน้า" onClick={goPrev}>
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M12.5 5 L7 10 L12.5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </ControlButton>
                <ControlButton label="สไลด์ถัดไป" onClick={goNext}>
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M7.5 5 L13 10 L7.5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </ControlButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
