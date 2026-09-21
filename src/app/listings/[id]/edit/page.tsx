import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import { requireVerifiedUserId } from "@/lib/session";
import { getListingById, getBidsForListing } from "@/lib/queries";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { EditListingForm } from "./EditListingForm";

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireVerifiedUserId();
  if (!userId) redirect("/login");

  const listing = await getListingById(id);
  if (!listing || listing.seller_id !== userId) notFound();

  const bids = await getBidsForListing(id);

  return (
    <div style={{ "--wrap-max": "680px" } as CSSProperties}>
      <BackHeader href="/profile" title="แก้ไขประกาศ" />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          <EditListingForm listing={listing} bidCount={bids.length} locked={bids.length > 0} />
        </div>
      </main>
      <Footer note="เอกสารแนวคิดฉบับพรีวิว — การบันทึกเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
