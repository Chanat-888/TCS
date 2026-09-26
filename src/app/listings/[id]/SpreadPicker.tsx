"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatTHB } from "@/lib/format";
import { totalPrice } from "@/lib/spreadPost";
import type { ListingItem } from "@/lib/supabase/types";
import { closeSpreadPost, reserveItems } from "./spreadActions";

const STATUS_LABEL = { available: "", reserved: "มีคนจองแล้ว", sold: "ขายแล้ว" } as const;

/**
 * The seller's photo(s) of the cards laid out, with a list of every card by its
 * number. The buyer ticks the cards they want and buys them all in one order.
 */
export function SpreadPicker({
  listingId,
  photos,
  items,
  isOwner,
  isOpen,
}: {
  listingId: string;
  photos: string[];
  items: ListingItem[];
  isOwner: boolean;
  isOpen: boolean;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unpaidOrderId, setUnpaidOrderId] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const byId = new Map(items.map((i) => [i.id, i]));
  // Anything that stopped being available since the page loaded can no longer be picked.
  const selected = picked.filter((id) => byId.get(id)?.status === "available");
  const chosen = selected.map((id) => byId.get(id)!).filter(Boolean);
  const total = totalPrice(chosen);
  const canPick = isOpen && !isOwner;
  const counts = {
    available: items.filter((i) => i.status === "available").length,
    reserved: items.filter((i) => i.status === "reserved").length,
    sold: items.filter((i) => i.status === "sold").length,
  };

  function toggle(item: ListingItem) {
    if (!canPick || item.status !== "available") return;
    setError("");
    setPicked((prev) => (prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]));
  }

  async function buy() {
    setBusy(true);
    setError("");
    setUnpaidOrderId(null);
    const result = await reserveItems(listingId, selected);
    if ("error" in result) {
      setBusy(false);
      setError(result.error ?? "เกิดข้อผิดพลาด ลองอีกครั้ง");
      if ("orderId" in result && result.orderId) setUnpaidOrderId(result.orderId);
      else router.refresh(); // someone else may have taken a card: show what is left
      return;
    }
    router.push(`/checkout/${result.orderId}`);
  }

  async function close() {
    setBusy(true);
    const result = await closeSpreadPost(listingId);
    setBusy(false);
    setConfirmClose(false);
    if ("error" in result) {
      setError(result.error ?? "เกิดข้อผิดพลาด ลองอีกครั้ง");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-col gap-3">
        {photos.map((url, index) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-2xl"
            style={{ background: "var(--panel-2)", border: "1px solid var(--line)" }}
            aria-label={`เปิดรูปที่ ${index + 1} ขนาดเต็ม`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`รูปการ์ดทั้งหมดในโพสต์ รูปที่ ${index + 1}`} className="block h-auto w-full" />
          </a>
        ))}
      </div>
      <p className="mt-2 text-[12.5px]" style={{ color: "var(--steel)" }}>
        แตะรูปเพื่อดูขนาดเต็ม · หมายเลขในรายการตรงกับหมายเลขที่ผู้ขายวางไว้ข้างการ์ดในรูป
      </p>

      <h2 className="mb-2 mt-6 text-[14px] font-medium" style={{ color: "var(--steel)" }}>
        รายการการ์ด — {canPick ? "ติ๊กใบที่ต้องการ" : "การ์ดทั้งหมดในโพสต์"} · ว่าง {counts.available} · จองแล้ว {counts.reserved} · ขายแล้ว {counts.sold}
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const isPicked = selected.includes(item.id);
          const available = item.status === "available";
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => toggle(item)}
                disabled={!canPick || !available}
                aria-pressed={isPicked}
                className="flex min-h-[60px] w-full items-center gap-3 rounded-xl p-3 text-left"
                style={{
                  background: isPicked ? "rgba(79,201,122,0.08)" : "var(--panel)",
                  border: `1px solid ${isPicked ? "var(--good)" : "var(--line)"}`,
                  opacity: available ? 1 : 0.55,
                }}
              >
                <span className="mono w-10 flex-shrink-0 text-[15px]" style={{ color: "var(--cyan)" }}>#{item.position}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium" style={{ color: "var(--white)" }}>{item.name}</span>
                  <span className="block text-[12px]" style={{ color: "var(--steel)" }}>
                    {item.rarity} · {item.condition}
                  </span>
                </span>
                <span className="flex-shrink-0 text-right">
                  <span className="mono block text-[15px]" style={{ color: "var(--white)" }}>{formatTHB(item.price)}</span>
                  {!available && (
                    <span className="block text-[11.5px]" style={{ color: "var(--steel)" }}>{STATUS_LABEL[item.status]}</span>
                  )}
                </span>
                {canPick && available && (
                  <span
                    aria-hidden="true"
                    className="flex flex-shrink-0 items-center justify-center rounded-md"
                    style={{
                      width: 24,
                      height: 24,
                      border: `2px solid ${isPicked ? "var(--good)" : "var(--line)"}`,
                      background: isPicked ? "var(--good)" : "transparent",
                      color: "#071523",
                      fontSize: 15,
                      lineHeight: 1,
                    }}
                  >
                    {isPicked ? "✓" : ""}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-3 text-[13px]" style={{ color: "var(--danger)" }}>
          {error}{" "}
          {unpaidOrderId && (
            <Link href={`/checkout/${unpaidOrderId}`} style={{ color: "var(--cyan)" }}>
              ไปชำระเงิน
            </Link>
          )}
        </p>
      )}

      {isOwner ? (
        <div className="mt-6 rounded-2xl p-4" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
          <p className="text-[13px]" style={{ color: "var(--steel)" }}>
            นี่คือโพสต์ของคุณเอง ผู้ซื้อติ๊กเลือกการ์ดเป็นใบ ๆ แล้วระบบสร้างคำสั่งซื้อให้ คุณจะเห็นคำสั่งขายในหน้าโปรไฟล์
          </p>
          {isOpen ? (
            confirmClose ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={close}
                  className="min-h-11 rounded-[10px] px-4 text-[13.5px] font-semibold"
                  style={{ background: "var(--danger)", color: "#fff" }}
                >
                  {busy ? "กำลังปิด…" : "ยืนยันปิดโพสต์"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClose(false)}
                  className="min-h-11 rounded-[10px] px-4 text-[13.5px]"
                  style={{ background: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--steel)" }}
                >
                  ยกเลิก
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClose(true)}
                className="mt-3 min-h-11 rounded-[10px] px-4 text-[13.5px]"
                style={{ background: "transparent", border: "1px solid var(--danger-line)", color: "var(--danger)" }}
              >
                ปิดโพสต์
              </button>
            )
          ) : (
            <p className="mt-3 text-[13px]" style={{ color: "var(--steel)" }}>โพสต์นี้ปิดแล้ว</p>
          )}
        </div>
      ) : (
        <div
          className="sticky bottom-3 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3"
          style={{ background: "var(--panel)", border: "1px solid var(--line)", boxShadow: "0 12px 30px -12px rgba(0,0,0,0.6)" }}
        >
          <div>
            <p className="text-[12px]" style={{ color: "var(--steel)" }}>
              {isOpen ? `เลือกแล้ว ${chosen.length} ใบ` : "โพสต์นี้ปิดแล้ว"}
            </p>
            <p className="mono text-[20px]" style={{ color: "var(--white)" }}>{formatTHB(total)}</p>
          </div>
          <button
            type="button"
            onClick={buy}
            disabled={busy || chosen.length === 0 || !isOpen}
            className="min-h-12 rounded-[11px] px-6 text-[14.5px] font-semibold disabled:opacity-50"
            style={{ background: "var(--blue)", color: "#071523" }}
          >
            {busy ? "กำลังจอง…" : chosen.length === 0 ? "เลือกการ์ดก่อน" : `ซื้อ ${chosen.length} ใบที่เลือก`}
          </button>
        </div>
      )}
    </div>
  );
}
