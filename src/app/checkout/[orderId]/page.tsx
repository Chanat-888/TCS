import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import { requireVerifiedUserId } from "@/lib/session";
import { getOrderDetail } from "@/lib/orders";
import { syncCharge } from "@/lib/omise";
import { listAddresses } from "@/lib/addressBook";
import type { SavedAddress } from "@/lib/addresses";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { CheckoutForm } from "./CheckoutForm";

export default async function CheckoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const userId = await requireVerifiedUserId();
  if (!userId) redirect("/login");

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
            isAuctionWin={detail.listing.buy_now_price == null}
            savedAddresses={savedAddresses}
          />
        </div>
      </main>
      <Footer note={process.env.OMISE_SECRET_KEY?.startsWith("skey_test_") ? "โหมดทดสอบ — ชำระผ่าน Omise test mode ไม่มีการตัดเงินจริง" : undefined} />
    </div>
  );
}
