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

  return (
    <>
      <div className="mt-[22px] rounded-2xl p-[22px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px]" style={{ color: "var(--steel)" }}>
              ราคาปัจจุบัน
            </p>
            <p className="mono mt-1 text-[30px]" style={{ color: "var(--white)" }}>
              {formatTHB(price)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[12px]" style={{ color: "var(--steel)" }}>
              ปิดประมูลใน
            </p>
            <p className="mono mt-1 flex items-center justify-end gap-[7px] text-[22px]" style={{ color: "var(--cyan)" }}>
              <span
                className="rounded-full"
                style={{ width: 7, height: 7, background: "var(--cyan)", boxShadow: "0 0 9px 1.5px var(--cyan)" }}
                aria-hidden="true"
              />
              <Countdown endsAt={endsAt} initialSeconds={initialSecondsLeft} onExpire={() => setExpired(true)} />
            </p>
            <p className="mono mt-1 text-[12px]" style={{ color: "var(--steel)" }}>
              {formatThaiDateTime(endsAt, { year: true })}
            </p>
          </div>
        </div>

        {buyNowPrice != null && !closed && (
          <div
            className="mt-[14px] flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[9px] px-3 py-2 text-[12.5px]"
            style={{ color: "var(--cyan)", background: "rgba(95,212,255,0.08)", border: "1px solid rgba(95,212,255,0.22)" }}
          >
            <span>ราคาชนะทันที</span>
            <span className="mono text-[14px]" style={{ color: "var(--white)" }}>
              {formatTHB(buyNowPrice)}
            </span>
            <span className="w-full text-[12px]" style={{ color: "var(--steel)" }}>
              {isOwner
                ? "ผู้ซื้อที่บิดถึงราคานี้จะชนะและปิดประมูลทันที"
                : "บิดถึงราคานี้เพื่อชนะและปิดประมูลทันที แล้วไปชำระเงินได้เลย"}
            </span>
          </div>
        )}

        {showExtend && (
          <div
            className="mt-[10px] flex items-center gap-[7px] rounded-[9px] px-3 py-2 text-[12.5px]"
            style={{ color: "var(--cyan)", background: "rgba(95,212,255,0.08)", border: "1px solid rgba(95,212,255,0.22)" }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path d="M10 5v5l3.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            <span>มีการบิดในช่วงโค้งสุดท้าย ระบบขยายเวลาให้อีก 2 นาที</span>
          </div>
        )}

        {isOwner ? (
          <>
            <p className="mt-[18px] text-[13px]" style={{ color: "var(--steel)" }}>
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
                    style={{ background: "var(--danger)", color: "#fff" }}
                  >
                    {ending ? "กำลังปิด…" : "ยืนยันปิดประมูล"}
                  </button>
                  <button
                    type="button"
                    disabled={ending}
                    onClick={() => { setConfirmEnd(false); setEndError(""); }}
                    ref={cancelEndRef}
                    className="min-h-11 rounded-[9px] px-4 text-[13px]"
                    style={{ background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--steel)" }}
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmEnd(true)}
                className="mt-3 min-h-11 rounded-[9px] px-4 text-[13px]"
                style={{ background: "transparent", border: "1px solid var(--danger-line)", color: "var(--danger)" }}
              >
                ปิดประมูลตอนนี้
              </button>
            )}
          </>
        ) : closed || expired ? (
          <p className="mt-[18px] text-[13px]" style={{ color: "var(--steel)" }}>
            {closed ? "ประกาศนี้ปิดการประมูลแล้ว" : "ปิดประมูลแล้ว"}
          </p>
        ) : (
          <>
            {youHaveBid && (
              <p
                className="mt-[18px] rounded-[9px] px-3 py-2 text-[12.5px]"
                style={
                  youAreTop
                    ? { color: "var(--cyan)", background: "rgba(95,212,255,0.08)", border: "1px solid rgba(95,212,255,0.22)" }
                    : { color: "var(--danger)", background: "rgba(255,90,90,0.08)", border: "1px solid rgba(255,90,90,0.25)" }
                }
              >
                {youAreTop ? "คุณเป็นผู้บิดสูงสุดอยู่ตอนนี้" : "มีคนบิดสูงกว่าคุณแล้ว — บิดใหม่เพื่อชิงกลับ"}
              </p>
            )}
            {youAreTop ? null : (
              <>
            <div className="mt-[18px] flex items-stretch gap-[10px]">
              <button
                type="button"
                aria-label="ลดจำนวนเงินบิด"
                onClick={() => {
                  setAmount(String(Math.max(minBid, (parseInt(amount, 10) || minBid) - bidIncrement)));
                  setError("");
                }}
                className="flex-shrink-0 rounded-[11px] text-[18px]"
                style={{ width: 48, height: 48, background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--steel)" }}
              >
                −
              </button>
              <div
                className="flex min-w-0 flex-1 items-center gap-2 rounded-[11px] px-[14px]"
                style={{ background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", height: 48 }}
              >
                <span className="mono flex-shrink-0 text-[15px]" style={{ color: "var(--steel)" }}>
                  ฿
                </span>
                <input
                  className="mono w-full min-w-0 flex-1 border-0 bg-transparent text-[17px] outline-none"
                  style={{ color: "var(--white)" }}
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value.replace(/\D/g, ""));
                    setError("");
                  }}
                />
              </div>
              <button
                type="button"
                aria-label="เพิ่มจำนวนเงินบิด"
                onClick={() => {
                  setAmount(String((parseInt(amount, 10) || minBid) + bidIncrement));
                  setError("");
                }}
                className="flex-shrink-0 rounded-[11px] text-[18px]"
                style={{ width: 48, height: 48, background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--steel)" }}
              >
                +
              </button>
            </div>
            <p className="mt-2 text-[12px]" style={{ color: "var(--steel-dim)" }}>
              บิดขั้นต่ำถัดไป <span className="mono">{formatTHB(minBid)}</span> (เพิ่มขึ้นทีละ {formatTHB(bidIncrement)})
            </p>
            {error && (
              <p className="mt-2 text-[12.5px]" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            )}
            <div className="mt-[14px]">
              <PrimaryButton loading={submitting} onClick={handlePlaceBid}>
                ยืนยันการบิด
              </PrimaryButton>
            </div>
              </>
            )}
            <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--steel-dim)" }}>
              หากมีการบิดภายใน 2 นาทีสุดท้ายก่อนปิดประมูล เวลาจะขยายอีก 2 นาทีโดยอัตโนมัติ เพื่อป้องกันการบิดชิงจังหวะสุดท้าย
            </p>
          </>
        )}
      </div>

      {showBuyNow && buyNowSlot}

      <div className="section">
        <h2 className="text-[1.1rem]">ประวัติการบิด</h2>
        <div className="mt-4 flex flex-col">
          {bids.length === 0 && (
            <p className="py-3 text-[13.5px]" style={{ color: "var(--steel)" }}>
              ยังไม่มีการบิด
            </p>
          )}
          {bids.map((bid, i) => {
            const isYou = bid.bidder_id === currentUserId;
            return (
              <div
                key={bid.id}
                className="flex items-center gap-3 py-3"
                style={i > 0 ? { borderTop: "1px solid rgba(140,147,163,0.1)" } : undefined}
              >
                <span
                  className="flex-shrink-0 rounded-full"
                  style={{
                    width: 7,
                    height: 7,
                    background: isYou ? "var(--cyan)" : "var(--steel-dim)",
                    boxShadow: isYou ? "0 0 7px 1px var(--cyan)" : undefined,
                  }}
                />
                <span className="text-[13.5px]" style={{ color: isYou ? "var(--cyan)" : "var(--white)", fontWeight: isYou ? 500 : 400 }}>
                  {isYou ? "คุณ" : maskUserLabel(bid.bidder_id)}
                </span>
                <span className="mono ml-auto text-[14px]" style={{ color: "var(--white)" }}>
                  {formatTHB(bid.amount)}
                </span>
                <span className="mono text-right text-[11.5px]" style={{ color: "var(--steel-dim)", minWidth: 70 }}>
                  {formatRelativeTime(bid.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
