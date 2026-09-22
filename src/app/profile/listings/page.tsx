import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireVerifiedUserId } from "@/lib/session";
import { getListingsBySeller } from "@/lib/queries";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import type { Listing, ListingStatus } from "@/lib/supabase/types";

const GROUPS: { status: ListingStatus; label: string }[] = [
  { status: "active", label: "กำลังขาย" },
  { status: "sold", label: "ขายแล้ว" },
  { status: "cancelled", label: "ยกเลิกแล้ว" },
  { status: "expired", label: "หมดเวลาประมูล" },
];

export default async function ManageListingsPage() {
  const userId = await requireVerifiedUserId();
  if (!userId) redirect("/login");

  const listings = await getListingsBySeller(userId);
  const byStatus = new Map<ListingStatus, Listing[]>();
  for (const listing of listings) {
    if (!byStatus.has(listing.status)) byStatus.set(listing.status, []);
    byStatus.get(listing.status)!.push(listing);
  }

  return (
    <div style={{ "--wrap-max": "1180px", "--wrap-pad": "24px", "--wrap-pad-sm": "16px" } as CSSProperties}>
      <BackHeader href="/profile" title="จัดการประกาศ" subtitle={`${listings.length} รายการ`} />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          {listings.length === 0 ? (
            <div
              className="mt-4 flex flex-col items-center rounded-2xl px-5 py-16 text-center"
              style={{ background: "var(--panel)", border: "1px dashed rgba(140,147,163,0.22)" }}
            >
              <h2 className="text-[1.15rem]">ยังไม่มีประกาศขาย</h2>
              <p className="mt-2 text-[13.5px]" style={{ color: "var(--steel)" }}>
                ลงประกาศการ์ดใบแรกของคุณได้เลย
              </p>
              <Link
                href="/listings/new"
                className="mt-5 inline-flex items-center gap-2 rounded-[11px] px-[22px] py-3 text-[14px] font-semibold no-underline"
                style={{ background: "var(--blue)", color: "#071523" }}
              >
                ลงประกาศใหม่
              </Link>
            </div>
          ) : (
            GROUPS.filter((g) => byStatus.has(g.status)).map((g) => (
              <section key={g.status} className="mt-10 first:mt-0">
                <div className="mb-[18px] flex items-baseline gap-3">
                  <h2 className="text-[1.15rem]">{g.label}</h2>
                  <span className="mono text-[12.5px]" style={{ color: "var(--steel)" }}>
                    {byStatus.get(g.status)!.length} รายการ
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-[18px] max-[1024px]:grid-cols-3 max-[720px]:grid-cols-2 max-[720px]:gap-3">
                  {byStatus.get(g.status)!.map((listing) => (
                    <ProductCard key={listing.id} listing={listing} ownerEditHref={`/listings/${listing.id}/edit`} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </main>
      <Footer note="เอกสารแนวคิดฉบับพรีวิว — รายการประกาศเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
