"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Countdown } from "@/components/Countdown";
import { formatTHB, formatRelativeTime, maskUserLabel } from "@/lib/format";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { Bid } from "@/lib/supabase/types";
import { placeBid } from "./actions";

const BID_INCREMENT = 100;

export function LiveBidding({
  listingId,
  initialPrice,
  initialEndsAt,
  initialSecondsLeft,
  initialBids,
  currentUserId,
  isOwner,
}: {
  listingId: string;
  initialPrice: number;
  initialEndsAt: string;
  initialSecondsLeft: number;
  initialBids: Bid[];
  currentUserId: string;
  isOwner: boolean;
}) {
  const [price, setPrice] = useState(initialPrice);
  const [endsAt, setEndsAt] = useState(initialEndsAt);
  const [bids, setBids] = useState(initialBids);
  const [amount, setAmount] = useState(String(initialPrice + BID_INCREMENT));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [expired, setExpired] = useState(initialSecondsLeft <= 0);
  const extendTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const minBid = price + BID_INCREMENT;

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
          const row = payload.new as { current_price: number; ends_at: string };
          setPrice(row.current_price);
          setEndsAt((prevEndsAt) => {
            if (row.ends_at !== prevEndsAt) {
              setShowExtend(true);
              if (extendTimeout.current) clearTimeout(extendTimeout.current);
              extendTimeout.current = setTimeout(() => setShowExtend(false), 5000);
            }
            return row.ends_at;
          });
          setExpired(false);
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
    setAmount(String(price + BID_INCREMENT));
  }, [price]);

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
    setPrice(result.newPrice);
    setEndsAt(result.newEndsAt);
    setBids((prev) => [
      { id: crypto.randomUUID(), listing_id: listingId, bidder_id: currentUserId, amount: value, created_at: new Date().toISOString() },
      ...prev,
    ]);
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
          </div>
        </div>

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
          <p className="mt-[18px] text-[13px]" style={{ color: "var(--steel)" }}>
            นี่คือประกาศของคุณเอง — ไม่สามารถบิดประกาศของตัวเองได้
          </p>
        ) : expired ? (
          <p className="mt-[18px] text-[13px]" style={{ color: "var(--steel)" }}>
            ปิดประมูลแล้ว
          </p>
        ) : (
          <>
            <div className="mt-[18px] flex items-stretch gap-[10px]">
              <button
                type="button"
                aria-label="ลดจำนวนเงินบิด"
                onClick={() => {
                  setAmount(String(Math.max(minBid, (parseInt(amount, 10) || minBid) - BID_INCREMENT)));
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
                  setAmount(String((parseInt(amount, 10) || minBid) + BID_INCREMENT));
                  setError("");
                }}
                className="flex-shrink-0 rounded-[11px] text-[18px]"
                style={{ width: 48, height: 48, background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--steel)" }}
              >
                +
              </button>
            </div>
            <p className="mt-2 text-[12px]" style={{ color: "var(--steel-dim)" }}>
              บิดขั้นต่ำถัดไป <span className="mono">{formatTHB(minBid)}</span> (เพิ่มขึ้นทีละ ฿100)
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
            <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--steel-dim)" }}>
              หากมีการบิดภายใน 2 นาทีสุดท้ายก่อนปิดประมูล เวลาจะขยายอีก 2 นาทีโดยอัตโนมัติ เพื่อป้องกันการบิดชิงจังหวะสุดท้าย
            </p>
          </>
        )}
      </div>

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
