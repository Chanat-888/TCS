import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { getOrderDetail, getMessagesForOrder } from "@/lib/orders";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { getShipProposals } from "@/lib/shipProposals";
import { OrderSellerView } from "./OrderSellerView";

export default async function OrderSellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const detail = await getOrderDetail(id, userId);
  if (!detail) notFound();
  if (!detail.isSeller) redirect(`/orders/${id}`);

  const [messages, proposals] = await Promise.all([getMessagesForOrder(id), getShipProposals(id)]);

  return (
    <div style={{ "--wrap-max": "720px" } as CSSProperties}>
      <BackHeader href={`/profile/${userId}`} title="คำสั่งขาย" subtitle={`#${detail.order.order_code}`} />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          <OrderSellerView order={detail.order} listingName={detail.listing.name} messages={messages} proposals={proposals} currentUserId={userId} />
        </div>
      </main>
      <Footer note="เอกสารแนวคิดฉบับพรีวิว — การยืนยันจัดส่งและแชทเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
