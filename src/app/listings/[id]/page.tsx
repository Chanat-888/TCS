import { PhoneVerificationNotice } from "@/components/PhoneVerificationNotice";
import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { getListingById, getBidsForListing, getSellerStats, getListingsBySeller } from "@/lib/queries";
import { secondsUntil } from "@/lib/countdown";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { SellerRow } from "@/components/SellerRow";
import { formatTHB } from "@/lib/format";
import { PhotoViewer } from "./PhotoViewer";
import { LiveBidding } from "./LiveBidding";
import { bidIncrementOf, isBuyNowAvailable, isFixedPrice } from "@/lib/listingKind";
import { BuyNowBox } from "./BuyNowBox";

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const listing = await getListingById(id);
  if (!listing) notFound();

  const [bids, sellerStats, otherListings] = await Promise.all([
    getBidsForListing(id),
    getSellerStats(listing.seller_id),
    getListingsBySeller(listing.seller_id, { status: "active", excludeId: id }),
  ]);

  const conditionTag = listing.condition;

  return (
    <div style={{ "--wrap-max": "1160px" } as CSSProperties}>
      <BackHeader href="/browse" title={listing.name} />
      <PhoneVerificationNotice />

      <main>
        <section className="pb-2 pt-8">
          <div className="wrap">
            <div className="grid grid-cols-[0.95fr_1.05fr] grid-rows-[auto_1fr] gap-x-10 gap-y-9 max-[900px]:grid-cols-1 max-[900px]:grid-rows-none max-[900px]:gap-7">
              <PhotoViewer
                name={listing.name}
                setName={listing.set_name}
                rarity={listing.rarity}
                frontUrl={listing.photo_front_url}
                backUrl={listing.photo_back_url}
              />

              <div className="min-[901px]:col-start-2 min-[901px]:row-span-2 min-[901px]:row-start-1">
                <h1 className="text-[clamp(1.35rem,2.6vw,1.7rem)] leading-tight">{listing.name}</h1>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["Cardfight!! Vanguard", conditionTag, listing.set_name].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-[11px] py-1 text-[12px] font-medium"
                      style={{ background: "var(--line-soft)", border: "1px solid var(--line)", color: "var(--steel)" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div
                  className="mt-5 flex items-start gap-[10px] rounded-xl px-[15px] py-[13px]"
                  style={{ background: "var(--cyan-tint)", border: "1px solid var(--cyan-line)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: "var(--cyan)", flexShrink: 0, marginTop: 1 }}>
                    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M6.5 10.2 L9 12.6 L13.5 7.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--steel)" }}>
                    <strong style={{ color: "var(--white)", fontWeight: 500 }}>เงินอยู่กับ TCS</strong> จนกว่าคุณจะกดรับการ์ด
                    ไม่พอใจ ได้เงินคืน — ผู้ขายจะเห็นสถานะ &ldquo;เงินถูกพักไว้&rdquo; ก่อนแพ็คส่งเสมอ
                  </p>
                </div>

                {isFixedPrice(listing) ? (
                  <BuyNowBox
                    listingId={listing.id}
                    price={listing.buy_now_price!}
                    isOwner={listing.seller_id === userId}
                    isSold={listing.status !== "active"}
                    name={listing.name}
                    setName={listing.set_name}
                    rarity={listing.rarity}
                    photoUrl={listing.photo_front_url}
                    sellerId={listing.seller_id}
                    sellerName={listing.seller.display_name}
                    sellerVerified={listing.seller.verified}
                      />
                ) : (
                  <LiveBidding
                    listingId={listing.id}
                    initialStatus={listing.status}
                    startPrice={listing.start_price}
                    buyNowPrice={listing.buy_now_price}
                    bidIncrement={bidIncrementOf(listing)}
                    initialPrice={listing.current_price}
                    initialEndsAt={listing.ends_at}
                    initialSecondsLeft={listing.status === "active" ? secondsUntil(listing.ends_at) : 0}
                    initialBids={bids}
                    currentUserId={userId}
                    isOwner={listing.seller_id === userId}
                    buyNowSlot={
                      listing.buy_now_price != null && (listing.status !== "active" || isBuyNowAvailable(listing)) ? (
                        <BuyNowBox
                          listingId={listing.id}
                          price={listing.buy_now_price!}
                          isOwner={listing.seller_id === userId}
                          isSold={listing.status !== "active"}
                          name={listing.name}
                          setName={listing.set_name}
                          rarity={listing.rarity}
                          photoUrl={listing.photo_front_url}
                          sellerId={listing.seller_id}
                          sellerName={listing.seller.display_name}
                          sellerVerified={listing.seller.verified}
                        />
                      ) : null
                    }
                  />
                )}
              </div>
              <section className="min-w-0 min-[901px]:col-start-1 min-[901px]:row-start-2">
                <h2 className="text-[1.1rem]">รายละเอียดการ์ด</h2>
                <p className="mt-[14px] max-w-[68ch] text-[14.5px] leading-loose" style={{ color: "var(--steel)" }}>
                  {listing.description}
                </p>
                <div
                  className="mt-4 grid gap-px overflow-hidden rounded-xl"
                  style={{ background: "var(--line-soft)", border: "1px solid var(--line-soft)" }}
                >
                  {[
                    ["ชุด", listing.set_name],
                    ["ความหายาก", listing.rarity],
                    ["สภาพ", listing.condition],
                    ["ราคาเริ่มต้น", formatTHB(listing.start_price)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 px-4 py-3" style={{ background: "var(--panel)" }}>
                      <span className="text-[12.5px]" style={{ color: "var(--steel)" }}>
                        {k}
                      </span>
                      <span className="text-[13px] font-medium" style={{ color: "var(--white)" }}>
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
                <SellerRow seller={listing.seller} stats={sellerStats} />
              </section>
            </div>
          </div>
        </section>

        {otherListings.length > 0 && (
          <section className="mt-14 pb-[60px]">
            <div className="wrap">
              <h2 className="text-[1.1rem]">ประกาศอื่นจาก {listing.seller.display_name}</h2>
              <div className="mt-4 grid grid-cols-4 gap-[18px] max-[1024px]:grid-cols-3 max-[720px]:grid-cols-2 max-[720px]:gap-3">
                {otherListings.slice(0, 4).map((other) => (
                  <ProductCard key={other.id} listing={other} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer note="เอกสารแนวคิดฉบับพรีวิว — การบิดในหน้านี้เชื่อมกับฐานข้อมูลจริง ยังไม่เชื่อมระบบชำระเงินจริง" />
    </div>
  );
}
