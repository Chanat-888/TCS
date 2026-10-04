import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import { requireVerifiedUserId } from "@/lib/session";
import { getListingById, getBidsForListing } from "@/lib/queries";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { isSpread } from "@/lib/listingKind";
import { EditListingForm } from "./EditListingForm";

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireVerifiedUserId();
  if (!userId) redirect("/login");

  const listing = await getListingById(id);
  if (!listing || listing.seller_id !== userId) notFound();

  const bids = await getBidsForListing(id);
  // Same rules as the save endpoint: a listing that is sold, cancelled or expired, or a pick-a-card
  // post, can't be edited, so say so here instead of showing a form that would fail on save.
  const reason =
    listing.status !== "active"
      ? "ประกาศนี้ปิดการขายแล้ว แก้ไขไม่ได้ เพื่อให้ข้อมูลตรงกับที่ผู้ซื้อสั่งซื้อ"
      : isSpread(listing)
        ? "โพสต์เลือกซื้อเป็นใบ ๆ แก้ไขไม่ได้ ถ้าต้องการเปลี่ยน กรุณาปิดโพสต์แล้วลงใหม่"
        : null;

  return (
    <div style={{ "--wrap-max": "680px" } as CSSProperties}>
      <BackHeader href="/profile" title="แก้ไขประกาศ" />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          {reason ? (
            <p className="rounded-2xl p-[18px] text-[14px] leading-relaxed" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)", color: "var(--steel)" }}>
              {reason}
            </p>
          ) : (
            <EditListingForm listing={listing} bidCount={bids.length} locked={bids.length > 0} />
          )}
        </div>
      </main>
      <Footer note="เอกสารแนวคิดฉบับพรีวิว — การบันทึกเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
