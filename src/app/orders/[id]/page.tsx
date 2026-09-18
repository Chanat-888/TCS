import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { getOrderDetail, getMessagesForOrder } from "@/lib/orders";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { OrderView } from "./OrderView";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const detail = await getOrderDetail(id, userId);
  if (!detail) notFound();
  if (!detail.isBuyer) redirect(`/orders/${id}/seller`);

  const messages = await getMessagesForOrder(id);

  return (
    <div style={{ "--wrap-max": "720px" } as CSSProperties}>
      <BackHeader href="/browse" title="สถานะคำสั่งซื้อ" subtitle={`#${detail.order.order_code}`} />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          <OrderView
            order={detail.order}
            listingName={detail.listing.name}
            sellerId={detail.seller.id}
            sellerName={detail.seller.display_name}
            messages={messages}
            currentUserId={userId}
          />
        </div>
      </main>
      <Footer note="เอกสารแนวคิดฉบับพรีวิว — การอัปโหลดวิดีโอและแชทเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
