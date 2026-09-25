"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Countdown } from "@/components/Countdown";
import { formatTHB, formatRelativeTime, formatThaiDateTime, maskUserLabel } from "@/lib/format";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { Bid } from "@/lib/supabase/types";
import { endAuctionNow, placeBid } from "./actions";

export function LiveBidding({
  listingId,
  initialStatus,
  startPrice,
  buyNowPrice,
  bidIncrement,
  initialPrice,
  initialEndsAt,
  initialSecondsLeft,
  initialBids,
  currentUserId,
  isOwner,
  buyNowSlot,
}: {
  listingId: string;
  initialStatus: string;
  startPrice: number;
  buyNowPrice: number | null;
  bidIncrement: number;
  initialPrice: number;
  initialEndsAt: string;
  initialSecondsLeft: number;
  initialBids: Bid[];
  currentUserId: string;
  isOwner: boolean;
  /** Buy-now box; shown only while the listing is unbid and still active, live. */
  buyNowSlot?: ReactNode;
}) {
  const router = useRouter();
  const nextMin = (p: number) => Math.min(p + bidIncrement, buyNowPrice ?? Infinity);
  const [status, setStatus] = useState(initialStatus);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState("");
  const cancelEndRef = useRef<HTMLButtonElement | null>(null);
  // Move focus into the confirm step (on the safe "cancel" choice) when it opens.
  useEffect(() => {
    if (confirmEnd) cancelEndRef.current?.focus();
  }, [confirmEnd]);
  const [price, setPrice] = useState(initialPrice);
  const [endsAt, setEndsAt] = useState(initialEndsAt);
  const [bids, setBids] = useState(initialBids);
  const [amount, setAmount] = useState(String(nextMin(initialPrice)));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [expired, setExpired] = useState(initialSecondsLeft <= 0);
  const [showAllBids, setShowAllBids] = useState(false);
  const extendTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const minBid = nextMin(price);
  const closed = status !== "active";
  const topBid = bids.reduce<Bid | null>((top, b) => (!top || b.amount > top.amount ? b : top), null);
  const youAreTop = topBid?.bidder_id === currentUserId;
  const youHaveBid = bids.some((b) => b.bidder_id === currentUserId);
  // A server-rendered sold listing keeps its "sold" buy-now box; a live one hides
  // it the moment the first bid lands or the listing closes.
  const showBuyNow = initialStatus !== "active" || (!closed && price <= startPrice);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`listing-${listingId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bids", filter: `listing_id=eq.${listingId}` },
        (payload) => {
          const bid = payload.new as Bid;
          setBids((prev) => (prev.some((b) => b.id === bid.id) ? prev : [bid, ...prev]));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "listings", filter: `id=eq.${listingId}` },
        (payload) => {
          const row = payload.new as { current_price: number; ends_at: string; status: string };
          setPrice(row.current_price);
          setStatus(row.status);
          setEndsAt((prevEndsAt) => {
            if (row.ends_at !== prevEndsAt) {
              setShowExtend(true);
              if (extendTimeout.current) clearTimeout(extendTimeout.current);
              extendTimeout.current = setTimeout(() => setShowExtend(false), 5000);
            }
            return row.ends_at;
          });
          // Only a still-active listing with time left can reopen; a sold or
          // cancelled update must never bring the bid form back.
          setExpired(row.status !== "active" || new Date(row.ends_at).getTime() <= Date.now());
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (extendTimeout.current) clearTimeout(extendTimeout.current);
    };
  }, [listingId]);

  useEffect(() => {
    // Resets the suggested bid whenever the price changes (own bid or
    // realtime update from someone else) — an intentional prop-driven reset.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAmount(String(nextMin(price)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price]);

  async function handleEndNow() {
    setEnding(true);
    setEndError("");
    const result = await endAuctionNow(listingId);
    setEnding(false);
    if ("error" in result) {
      setEndError(result.error ?? "เกิดข้อผิดพลาด ลองอีกครั้ง");
      return;
    }
    setConfirmEnd(false);
    setStatus(result.outcome === "sold" ? "sold" : "cancelled");
    router.refresh();
  }

  async function handlePlaceBid() {
    const value = parseInt(amount, 10);
    if (!value || value < minBid) {
      setError("กรอกจำนวนเงินอย่างน้อยราคาบิดขั้นต่ำ");
      return;
    }
    setSubmitting(true);
    setError("");
    const result = await placeBid(listingId, value);
    setSubmitting(false);
    if ("error" in result) {
      setError(result.error ?? "เกิดข้อผิดพลาด ลองอีกครั้ง");
      return;
    }
    if (result.won) {
      router.push(`/checkout/${result.orderId}`);
      return;
    }
    setPrice(result.newPrice);
    setEndsAt(result.newEndsAt);
    setBids((prev) => (prev.some((b) => b.id === result.bid.id) ? prev : [result.bid, ...prev]));
    if (result.extended) {
      setShowExtend(true);
      if (extendTimeout.current) clearTimeout(extendTimeout.current);
      extendTimeout.current = setTimeout(() => setShowExtend(false), 5000);
    }
  }

  const typed = parseInt(amount, 10) || minBid;
  const winsOutright = buyNowPrice != null && typed >= buyNowPrice;
  const ended = closed || expired;
  const BIDS_SHOWN = 6;
  const visibleBids = showAllBids ? bids : bids.slice(0, BIDS_SHOWN);
  // One always-mounted live region, so realtime changes (price, outbid, extension) are announced.
  const announcement = [
    showExtend ? "ระบบขยายเวลาปิดประมูลอีก 2 นาที" : "",
    !isOwner && youHaveBid && !ended ? (youAreTop ? "คุณเป็นผู้บิดสูงสุด" : "มีคนบิดสูงกว่าคุณแล้ว") : "",
    `ราคาปัจจุบัน ${formatTHB(price)}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const hairline = { borderTop: "1px solid var(--line-soft)" };
  const stepBtn =
    "flex w-12 flex-shrink-0 items-center justify-center transition-colors duration-150 hover:bg-[var(--line-soft)] hover:text-[var(--white)]";

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <div className="mt-[22px] overflow-hidden rounded-2xl" style={{ background: "var(--panel)", border: "1px solid var(--line-soft)" }}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 px-[22px] pb-5 pt-[22px]">
          <div className="min-w-0">
            <p className="text-[12.5px]" style={{ color: "var(--steel)" }}>
              ราคาปัจจุบัน
            </p>
            <p className="mono mt-1 text-[clamp(30px,4vw,40px)] leading-none" style={{ color: "var(--white)" }}>
              {formatTHB(price)}
            </p>
            <p className="mono mt-[10px] text-[12px]" style={{ color: "var(--steel)" }}>
              {bids.length} บิด · เริ่ม {formatTHB(startPrice)}
            </p>
          </div>
          <div className="text-right">
            <p className="flex items-center justify-end gap-[6px] text-[12.5px]" style={{ color: "var(--steel)" }}>
              {!ended && (
                <span
                  className="size-[6px] rounded-full animate-pulse motion-reduce:animate-none"
                  style={{ background: "var(--cyan)" }}
                  aria-hidden="true"
                />
              )}
              {ended ? "ปิดประมูลเมื่อ" : "ปิดประมูลใน"}
            </p>
            <p className="mono mt-1 text-[clamp(20px,2.6vw,24px)] leading-none" style={{ color: ended ? "var(--steel)" : "var(--cyan)" }}>
              {ended ? "ปิดแล้ว" : <Countdown endsAt={endsAt} initialSeconds={initialSecondsLeft} onExpire={() => setExpired(true)} />}
            </p>
            <p className="mono mt-[10px] text-[12px]" style={{ color: "var(--steel)" }}>
              {formatThaiDateTime(endsAt, { year: true })}
            </p>
          </div>
        </div>

        {showExtend && (
          <div
            className="flex items-center gap-2 px-[22px] py-[10px] text-[12.5px]"
            style={{ ...hairline, color: "var(--cyan)", background: "var(--cyan-tint)" }}
          >
            <ClockIcon />
            <span>มีการบิดในช่วงโค้งสุดท้าย ระบบขยายเวลาให้อีก 2 นาที</span>
          </div>
        )}

        {buyNowPrice != null && !closed && (
          <div className="flex items-center gap-3 px-[22px] py-[14px]" style={hairline}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: "var(--cyan)", flexShrink: 0 }}>
              <path d="M11.2 2.5 4.5 11.2h5l-1 6.3 6.8-8.8h-5.1l1-6.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium" style={{ color: "var(--white)" }}>
                ราคาชนะทันที
              </p>
              <p className="mt-[2px] text-[12px] leading-snug" style={{ color: "var(--steel)" }}>
                {isOwner
                  ? "ผู้ซื้อที่บิดถึงราคานี้จะชนะและปิดประมูลทันที"
                  : "บิดถึงราคานี้เพื่อชนะและปิดประมูลทันที แล้วไปชำระเงินได้เลย"}
              </p>
            </div>
            <p className="mono flex-shrink-0 text-[16px]" style={{ color: "var(--white)" }}>
              {formatTHB(buyNowPrice)}
            </p>
          </div>
        )}

        <div className="px-[22px] py-5" style={hairline}>
          {isOwner ? (
            <>
              <p className="text-[13px]" style={{ color: "var(--steel)" }}>
                นี่คือประกาศของคุณเอง — ไม่สามารถบิดประกาศของตัวเองได้
              </p>
              {closed ? (
                <p className="mt-2 text-[13px]" style={{ color: "var(--steel)" }}>
                  ประกาศนี้ปิดการประมูลแล้ว
                </p>
              ) : confirmEnd ? (
                <div className="mt-3 rounded-[11px] p-[14px]" style={{ background: "var(--danger-tint)", border: "1px solid var(--danger-line)" }}>
                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--white)" }}>
                    {bids.length > 0
                      ? `ปิดประมูลตอนนี้และขายให้ผู้บิดสูงสุดที่ ${formatTHB(price)} ทันที ระบบจะสร้างคำสั่งซื้อให้ผู้ชนะ ย้อนกลับไม่ได้`
                      : "ยังไม่มีผู้บิด ประกาศนี้จะถูกยกเลิกทันที ย้อนกลับไม่ได้"}
                  </p>
                  {endError && (
                    <p className="mt-2 text-[12.5px]" style={{ color: "var(--danger)" }}>
                      {endError}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={ending}
                      onClick={handleEndNow}
                      className="min-h-11 rounded-[9px] px-4 text-[13px] font-semibold disabled:opacity-60"
                      style={{ background: "var(--danger)", color: "var(--ink-on-danger)" }}
                    >
                      {ending ? "กำลังปิด…" : "ยืนยันปิดประมูล"}
                    </button>
                    <button
                      type="button"
                      disabled={ending}
                      onClick={() => { setConfirmEnd(false); setEndError(""); }}
                      ref={cancelEndRef}
                      className="min-h-11 rounded-[9px] px-4 text-[13px]"
                      style={{ background: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--steel)" }}
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmEnd(true)}
                  className="mt-3 min-h-11 rounded-[9px] px-4 text-[13px] transition-colors duration-150 hover:bg-[var(--danger-tint)]"
                  style={{ border: "1px solid var(--danger-line)", color: "var(--danger)" }}
                >
                  ปิดประมูลตอนนี้
                </button>
              )}
            </>
          ) : ended ? (
            <p className="text-[13px]" style={{ color: "var(--steel)" }}>
              {closed ? "ประกาศนี้ปิดการประมูลแล้ว" : "ปิดประมูลแล้ว"}
            </p>
          ) : (
            <>
              {youHaveBid && (
                <div
                  className={`${youAreTop ? "" : "mb-4 "}flex items-center gap-[9px] rounded-[10px] px-3 py-[10px] text-[13px]`}
                  style={
                    youAreTop
                      ? { color: "var(--cyan)", background: "var(--cyan-tint)", border: "1px solid var(--cyan-line)" }
                      : { color: "var(--danger)", background: "var(--danger-tint)", border: "1px solid var(--danger-line)" }
                  }
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
                    {youAreTop ? (
                      <path d="M6.5 10.2 9 12.6l4.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    ) : (
                      <path d="M10 5.8v5M10 13.6v.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    )}
                  </svg>
                  {youAreTop ? "คุณเป็นผู้บิดสูงสุดอยู่ตอนนี้" : "มีคนบิดสูงกว่าคุณแล้ว — บิดใหม่เพื่อชิงกลับ"}
                </div>
              )}
              {youAreTop ? null : (
                <>
                  <div
                    className="flex h-14 items-stretch overflow-hidden rounded-[12px] border border-[var(--line)] transition-colors duration-150 focus-within:border-[var(--cyan)] focus-within:shadow-[0_0_0_1px_var(--cyan)]"
                    style={{ background: "var(--panel-2)", color: "var(--steel)" }}
                  >
                    <button
                      type="button"
                      aria-label="ลดจำนวนเงินบิด"
                      disabled={typed <= minBid}
                      onClick={() => {
                        setAmount(String(Math.max(minBid, typed - bidIncrement)));
                        setError("");
                      }}
                      className={`${stepBtn} disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent`}
                      style={{ borderRight: "1px solid var(--line-soft)" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M4.5 10h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>
                    <label className="flex min-w-0 flex-1 items-center justify-center gap-[6px] px-3">
                      <span className="mono text-[16px]" style={{ color: "var(--steel)" }}>
                        ฿
                      </span>
                      <input
                        className="mono min-w-0 border-0 bg-transparent text-[21px] outline-none"
                        style={{ width: `${Math.max(amount.length, 1) + 0.6}ch`, color: "var(--white)", caretColor: "var(--cyan)" }}
                        inputMode="numeric"
                        aria-label="จำนวนเงินบิด"
                        aria-describedby={error ? "bid-min-note bid-error" : "bid-min-note"}
                        aria-invalid={error ? true : undefined}
                        value={amount}
                        onChange={(e) => {
                          setAmount(e.target.value.replace(/\D/g, ""));
                          setError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !submitting) handlePlaceBid();
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      aria-label="เพิ่มจำนวนเงินบิด"
                      onClick={() => {
                        setAmount(String(typed + bidIncrement));
                        setError("");
                      }}
                      className={stepBtn}
                      style={{ borderLeft: "1px solid var(--line-soft)" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M4.5 10h11M10 4.5v11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  <p id="bid-min-note" className="mt-2 text-[12px]" style={{ color: "var(--steel)" }}>
                    บิดขั้นต่ำถัดไป <span className="mono" style={{ color: "var(--white)" }}>{formatTHB(minBid)}</span> (เพิ่มขึ้นทีละ{" "}
                    {formatTHB(bidIncrement)})
                  </p>
                  {error && (
                    <p id="bid-error" className="mt-2 text-[12.5px]" style={{ color: "var(--danger)" }} role="alert">
                      {error}
                    </p>
                  )}
                  <div className="mt-4">
                    <PrimaryButton loading={submitting} onClick={handlePlaceBid}>
                      {winsOutright ? "บิดเพื่อชนะทันที" : "ยืนยันการบิด"} <span className="mono">{formatTHB(typed)}</span>
                    </PrimaryButton>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {!isOwner && !ended && (
          <p
            className="flex items-start gap-2 px-[22px] py-3 text-[12px] leading-relaxed"
            style={{ ...hairline, color: "var(--steel)", background: "color-mix(in srgb, var(--bg) 35%, transparent)" }}
          >
            <span className="mt-[3px]">
              <ClockIcon />
            </span>
            หากมีการบิดภายใน 2 นาทีสุดท้ายก่อนปิดประมูล เวลาจะขยายอีก 2 นาทีโดยอัตโนมัติ เพื่อป้องกันการบิดชิงจังหวะสุดท้าย
          </p>
        )}
      </div>

      {showBuyNow && buyNowSlot}

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[1.1rem]">ประวัติการบิด</h2>
          {bids.length > 0 && (
            <span className="mono text-[12px]" style={{ color: "var(--steel)" }}>
              {bids.length} รายการ
            </span>
          )}
        </div>
        {bids.length === 0 ? (
          <p className="mt-3 py-3 text-[13.5px]" style={{ color: "var(--steel)" }}>
            ยังไม่มีการบิด
          </p>
        ) : (
          <ol className="mt-3 flex flex-col" style={{ borderTop: "1px solid var(--line-soft)" }}>
            {visibleBids.map((bid) => {
              const isYou = bid.bidder_id === currentUserId;
              const isTop = bid.id === topBid?.id;
              return (
                <li key={bid.id} className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid var(--line-soft)" }}>
                  <span
                    className="size-[7px] flex-shrink-0 rounded-full"
                    style={{ background: isYou ? "var(--cyan)" : isTop ? "var(--white)" : "var(--steel-dim)" }}
                    aria-hidden="true"
                  />
                  <span
                    className="min-w-0 truncate text-[13.5px]"
                    style={{ color: isYou ? "var(--cyan)" : "var(--white)", fontWeight: isYou ? 500 : 400 }}
                  >
                    {isYou ? "คุณ" : maskUserLabel(bid.bidder_id)}
                  </span>
                  {isTop && (
                    <span
                      className="flex-shrink-0 rounded-full px-2 py-[1px] text-[10.5px]"
                      style={{ color: "var(--cyan)", background: "var(--cyan-tint)", border: "1px solid var(--cyan-line)" }}
                    >
                      สูงสุด
                    </span>
                  )}
                  <span className="mono ml-auto text-[14px]" style={{ color: isTop ? "var(--white)" : "var(--steel)" }}>
                    {formatTHB(bid.amount)}
                  </span>
                  <span className="text-right text-[12px]" style={{ color: "var(--steel)", minWidth: 84 }}>
                    {formatRelativeTime(bid.created_at)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {bids.length > BIDS_SHOWN && (
          <button
            type="button"
            aria-expanded={showAllBids}
            onClick={() => setShowAllBids((v) => !v)}
            className="mt-2 min-h-11 text-[13px] font-medium transition-colors hover:text-[var(--white)]"
            style={{ color: "var(--cyan)" }}
          >
            {showAllBids ? "แสดงน้อยลง" : `ดูทั้งหมด (${bids.length})`}
          </button>
        )}
      </section>
    </>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 5v5l3.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
