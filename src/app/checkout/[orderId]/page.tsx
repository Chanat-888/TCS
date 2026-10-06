import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import { requireVerifiedUserId } from "@/lib/session";
import { requireTerms } from "@/lib/terms";
import { getOrderDetail } from "@/lib/orders";
import { syncCharge } from "@/lib/omise";
import { listAddresses } from "@/lib/addressBook";
import type { SavedAddress } from "@/lib/addresses";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { getOrderItems } from "@/lib/listingItems";
import { OrderItemsList } from "@/components/OrderItemsList";
import { paymentQr } from "@/lib/promptpayQr";
import { CheckoutForm } from "./CheckoutForm";

export default async function CheckoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const userId = await requireVerifiedUserId();
  if (!userId) redirect("/login");
  await requireTerms(userId, `/checkout/${orderId}`);

  const detail = await getOrderDetail(orderId, userId);
  if (!detail || !detail.isBuyer) notFound();

  // Coming back from TrueMoney (Omise's return_uri) lands here: settle the charge
  // now rather than waiting for the webhook.
  const chargeId = detail.order.omise_charge_id;
  const justPaid = detail.order.status === "PENDING_PAYMENT" && chargeId
    ? (await syncCharge(chargeId).catch(() => null)) === "successful"
    : false;
  if (detail.order.status !== "PENDING_PAYMENT" || justPaid) {
    redirect(`/orders/${orderId}`);
  }

  // The address book is a convenience: if it cannot load, checkout still works
  // with a typed-in address.
  let savedAddresses: SavedAddress[] = [];
  try {
    savedAddresses = await listAddresses(userId);
  } catch (e) {
    console.error("[checkout] address book unavailable", (e as { code?: string }).code);
  }

  const orderItems = await getOrderItems(orderId);
  // Back on the page after choosing delivery (a refresh, or a rejected slip): show the QR again.
  const initialQr = detail.order.payment_method === "promptpay" ? await paymentQr(detail.order.amount) : null;

  return (
    <div style={{ "--wrap-max": "640px" } as CSSProperties}>
      <BackHeader href={`/listings/${detail.listing.id}`} title="ชำระเงิน" />
      <main className="py-7 pb-20">
        <div className="wrap">
          <OrderItemsList items={orderItems} />
          <CheckoutForm
            orderId={detail.order.id}
            listingName={detail.listing.name}
            sellerId={detail.seller.id}
            sellerName={detail.seller.display_name}
            amount={detail.order.amount}
            paymentDeadlineAt={detail.order.payment_deadline_at ?? new Date().toISOString()}
            isAuctionWin={detail.listing.buy_now_price == null}
            savedAddresses={savedAddresses}
            initialQr={initialQr}
            initialDelivery={detail.order.delivery_method === "meetup" ? "meetup" : "ship"}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
