import Link from "next/link";
import type { Profile } from "@/lib/supabase/types";
import { Avatar } from "./Avatar";
import type { SellerStats } from "@/lib/queries";

export function SellerRow({ seller, stats }: { seller: Profile; stats: SellerStats }) {
  return (
    <Link
      href={`/profile/${seller.id}`}
      className="mt-[22px] flex items-center gap-[13px] rounded-2xl px-4 py-[15px] no-underline"
      style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)", color: "inherit" }}
    >
      <Avatar
        url={seller.avatar_url}
        initial={seller.avatar_initial}
        className="text-[15px] font-bold"
        style={{ width: 44, height: 44, border: "1.5px solid rgba(95,212,255,0.3)", color: "var(--cyan)" }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-[7px]">
          <span className="text-[14.5px] font-medium" style={{ color: "var(--white)" }}>
            {seller.display_name}
          </span>
          {seller.verified && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10.5px]"
              style={{ background: "rgba(95,212,255,0.1)", border: "1px solid rgba(95,212,255,0.3)", color: "var(--cyan)" }}
            >
              <svg width="10" height="10" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.8" />
                <path d="M6.5 10.2 L9 12.6 L13.5 7.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              ยืนยันแล้ว
            </span>
          )}
          {seller.tier && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10.5px]"
              style={{ background: "rgba(232,184,79,0.1)", border: "1px solid rgba(232,184,79,0.3)", color: "var(--gold)" }}
            >
              <svg width="10" height="10" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M10 2 L12.2 7.4 L18 8 L13.6 11.8 L15 17.5 L10 14.2 L5 17.5 L6.4 11.8 L2 8 L7.8 7.4 Z" fill="currentColor" />
              </svg>
              {seller.tier}
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px]" style={{ color: "var(--steel)" }}>
          {stats.avgRating.toFixed(1)} ★ จาก {stats.reviewCount} รีวิว · ปิดการขายแล้ว {stats.completedSales} ครั้ง
        </p>
      </div>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: "var(--steel)", flexShrink: 0 }}>
        <path d="M7.5 4 L14 10 L7.5 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
