import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { getOrderDetail } from "@/lib/orders";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { CheckoutForm } from "./CheckoutForm";

export default async function CheckoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const detail = await getOrderDetail(orderId, userId);
  if (!detail || !detail.isBuyer) notFound();

  if (detail.order.status !== "PENDING_PAYMENT") {
    redirect(`/orders/${orderId}`);
  }

  return (
    <div style={{ "--wrap-max": "640px" } as CSSProperties}>
      <BackHeader href={`/listings/${detail.listing.id}`} title="ชำระเงิน" />
      <main className="py-7 pb-20">
        <div className="wrap">
          <CheckoutForm
            orderId={detail.order.id}
            listingName={detail.listing.name}
            sellerId={detail.seller.id}
            sellerName={detail.seller.display_name}
            amount={detail.order.amount}
            paymentDeadlineAt={detail.order.payment_deadline_at ?? new Date().toISOString()}
          />
        </div>
      </main>
      <Footer note="เอกสารแนวคิดฉบับพรีวิว — การชำระเงินจำลองไว้เพื่อสาธิตการออกแบบ ไม่มีการเชื่อมต่อผู้ให้บริการชำระเงินจริง และไม่มีการเก็บข้อมูลบัตร" />
    </div>
  );
}
