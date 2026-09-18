import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { getOrderDetail } from "@/lib/orders";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { ReviewForm } from "./ReviewForm";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const detail = await getOrderDetail(id, userId);
  if (!detail || !detail.isBuyer) notFound();
  if (detail.order.status !== "COMPLETED") redirect(`/orders/${id}`);

  return (
    <div style={{ "--wrap-max": "620px" } as CSSProperties}>
      <BackHeader href={`/orders/${id}`} title="ให้คะแนนร้านค้า" />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          <ReviewForm orderId={id} sellerId={detail.seller.id} sellerName={detail.seller.display_name} listingName={detail.listing.name} amount={detail.order.amount} />
        </div>
      </main>
      <Footer note="เอกสารแนวคิดฉบับพรีวิว — การส่งรีวิวเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
