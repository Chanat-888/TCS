import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { secondsUntil } from "@/lib/countdown";
import { formatTHB } from "@/lib/format";
import type { Listing, Profile } from "@/lib/supabase/types";

const CREST_PATHS = {
  burst: "M16 2 L19 10 L27 8 L22 15 L28 20 L20 21 L21 29 L16 23 L11 29 L12 21 L4 20 L10 15 L5 8 L13 10 Z",
  star: "M16 3 L20 13 L31 13 L22 20 L25 30 L16 24 L7 30 L10 20 L1 13 L12 13 Z",
  spark: "M16 2 L19 13 L30 16 L19 19 L16 30 L13 19 L2 16 L13 13 Z",
};

/** Deterministic crest per listing so it doesn't change between renders/pages. */
function crestFor(id: string) {
  const keys = Object.keys(CREST_PATHS) as (keyof typeof CREST_PATHS)[];
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CREST_PATHS[keys[hash % keys.length]];
}

export function ProductCard({
  listing,
  seller,
  salesCount,
  ownerEditHref,
}: {
  listing: Listing;
  seller?: Pick<Profile, "display_name">;
  salesCount?: number;
  /** Owner's-own-profile variant: floating edit button instead of the seller row. */
  ownerEditHref?: string;
}) {
  const isBuyNow = listing.buy_now_price != null;
  const price = isBuyNow ? listing.buy_now_price! : listing.current_price;

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-[14px] transition-[border-color,transform] duration-150 hover:-translate-y-0.5"
      style={{ background: "var(--panel)", border: "1px solid rgba(140, 147, 163, 0.12)" }}
    >
      {ownerEditHref && (
        <Link
          href={ownerEditHref}
          aria-label="แก้ไขประกาศ"
          className="absolute bottom-[9px] right-[9px] z-10 flex items-center justify-center rounded-lg"
          style={{
            width: 28,
            height: 28,
            background: "rgba(10,12,16,0.72)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(140,147,163,0.25)",
            color: "var(--steel)",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M13.5 3.5 L16.5 6.5 L7 16 L3.5 16.5 L4 13 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </Link>
      )}
      <Link href={`/listings/${listing.id}`} className="contents no-underline text-inherit">
        <div
          className="relative flex items-center justify-center"
          style={{ aspectRatio: "5 / 6", background: "var(--panel-2)" }}
        >
          {isBuyNow ? (
            <span
              className="mono absolute left-[9px] top-[9px] rounded-full px-2 py-[3px] text-[10.5px]"
              style={{ color: "var(--steel)", background: "rgba(140, 147, 163, 0.1)", border: "1px solid rgba(140, 147, 163, 0.22)" }}
            >
              ซื้อทันที
            </span>
          ) : (
            <span
              className="mono absolute left-[9px] top-[9px] rounded-full px-2 py-[3px] text-[10.5px]"
              style={{ color: "var(--cyan)", background: "rgba(95, 212, 255, 0.1)", border: "1px solid rgba(95, 212, 255, 0.28)" }}
            >
              ใกล้ปิด <Countdown endsAt={listing.ends_at} initialSeconds={secondsUntil(listing.ends_at)} />
            </span>
          )}
          <span
            className="mono absolute right-[9px] top-[9px] rounded-md px-[6px] py-[2px] text-[10px]"
            style={{ color: "var(--blue-dim)", background: "rgba(47, 143, 232, 0.12)" }}
          >
            {listing.rarity}
          </span>
          {listing.photo_front_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.photo_front_url}
              alt={listing.name}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <svg className="w-[34%] h-[34%]" viewBox="0 0 32 32" aria-hidden="true">
              <path d={crestFor(listing.id)} fill="var(--blue)" opacity={0.85} />
            </svg>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 px-[14px] pb-[14px] pt-3">
          <p
            className="text-[13.5px] font-medium leading-snug overflow-hidden"
            style={{
              color: "var(--white)",
              minHeight: "2.8em",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {listing.name}
          </p>
          <div className="flex items-baseline justify-between">
            <span className="mono text-[15px]" style={{ color: "var(--white)" }}>
              {formatTHB(price!)}
            </span>
            <span className="text-[10.5px]" style={{ color: "var(--steel-dim)" }}>
              {isBuyNow ? "ซื้อทันที" : "ราคาปัจจุบัน"}
            </span>
          </div>

          {!ownerEditHref && seller && (
            <div
              className="flex min-w-0 items-center gap-[6px] pt-2 text-[11.5px]"
              style={{ borderTop: "1px solid rgba(140, 147, 163, 0.1)", color: "var(--steel)" }}
            >
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: "var(--cyan)", flexShrink: 0 }}>
                <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path d="M6.5 10.2 L9 12.6 L13.5 7.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{seller.display_name}</span>
              {salesCount != null && (
                <span className="mono ml-auto flex-shrink-0 pl-[6px] whitespace-nowrap" style={{ color: "var(--steel-dim)" }}>
                  {salesCount} ออเดอร์
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}
