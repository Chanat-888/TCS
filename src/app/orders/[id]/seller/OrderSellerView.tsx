"use client";

import { useState } from "react";
import { OrderTimeline, type TimelineStep } from "@/components/OrderTimeline";
import { StatusPill } from "@/components/StatusPill";
import { ChatPanel } from "@/components/ChatPanel";
import { formatTHB, maskUserLabel, formatRelativeTime } from "@/lib/format";
import type { Message, Order } from "@/lib/supabase/types";
import { confirmHandover, confirmShipment } from "./actions";
import { sendOrderMessage } from "../actions";

const COURIERS = ["Flash Express", "Kerry Express", "ไปรษณีย์ไทย (EMS)", "J&T Express"];

export function OrderSellerView({
  order,
  listingName,
  messages,
  currentUserId,
}: {
  order: Order;
  listingName: string;
  messages: Message[];
  currentUserId: string;
}) {
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shipped, setShipped] = useState(Boolean(order.shipped_at));
  const [shippedInfo, setShippedInfo] = useState({ courier: order.courier ?? "", tracking: order.tracking_number ?? "" });

  async function handleConfirm() {
    if (!courier || !tracking.trim()) {
      setError("เลือกบริษัทขนส่งและกรอกเลขพัสดุก่อนยืนยัน");
      return;
    }
    setSubmitting(true);
    setError("");
    const result = await confirmShipment(order.id, courier, tracking);
    setSubmitting(false);
    if ("error" in result) {
      setError(result.error ?? "เกิดข้อผิดพลาด ลองอีกครั้ง");
      return;
    }
    setShippedInfo({ courier, tracking });
    setShipped(true);
  }

  async function handleHandover() {
    setSubmitting(true);
    setError("");
    const result = await confirmHandover(order.id);
    setSubmitting(false);
    if ("error" in result) {
      setError(result.error ?? "เกิดข้อผิดพลาด ลองอีกครั้ง");
      return;
    }
    setShipped(true);
  }

  const isMeetup = order.delivery_method === "meetup";
  const isDone = order.status === "COMPLETED";
  const steps: TimelineStep[] = [
    { label: "เงินถูกพักไว้", state: "done", meta: <>ผู้ซื้อชำระเงินแล้ว · <span className="mono">{order.paid_at ? formatRelativeTime(order.paid_at) : ""}</span></> },
    { label: isMeetup ? "ส่งมอบสินค้า (นัดรับ)" : "จัดส่งสินค้า", state: shipped ? "done" : "pending", meta: shipped ? (isMeetup ? "ส่งมอบแล้ว" : <>{shippedInfo.courier} · เลขพัสดุ <span className="mono">{shippedInfo.tracking}</span></>) : (isMeetup ? "นัดสถานที่และเวลากับผู้ซื้อในแชท แล้วกดยืนยันส่งมอบ" : "กรอกขนส่งและเลขพัสดุเพื่อยืนยันการจัดส่ง") },
    { label: "ถึงมือผู้ซื้อ", state: order.delivered_at ? "done" : "pending", meta: "อัปเดตอัตโนมัติเมื่อผู้ซื้อยืนยันว่าได้รับพัสดุ" },
    { label: "ผู้ซื้อยืนยันรับการ์ด", state: isDone ? "done" : "pending", meta: "ผู้ซื้อถ่ายวิดีโอแกะกล่องแล้วกดรับ หรือระบบอนุมัติอัตโนมัติภายใน 48 ชม." },
    { label: "เงินโอนเข้าบัญชีคุณ", state: isDone ? "done" : "pending", meta: <>{formatTHB(order.amount)} โอนเข้าบัญชีที่ยืนยันตัวตนไว้</> },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-[14px] rounded-2xl p-4" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
        <div className="flex flex-shrink-0 items-center justify-center rounded-[9px]" style={{ width: 52, height: 68, background: "var(--panel-2)", border: "1px solid rgba(95,212,255,0.25)" }}>
          <svg width="46%" height="46%" viewBox="0 0 64 64" aria-hidden="true">
            <path d="M32 4 L40 28 L64 28 L44 42 L52 64 L32 50 L12 64 L20 42 L0 28 L24 28 Z" fill="var(--cyan)" />
          </svg>
        </div>
        <div className="min-w-[160px] flex-1">
          <p className="text-[14.5px] font-medium" style={{ color: "var(--white)" }}>
            {listingName}
          </p>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--steel)" }}>
            ผู้ซื้อ <span className="mono">{maskUserLabel(order.buyer_id).replace("ผู้ใช้ ", "")}</span> · {formatTHB(order.amount)}
          </p>
        </div>
        {isDone ? <StatusPill tone="done" label="เสร็จสมบูรณ์" /> : shipped ? <StatusPill tone="wait" label="จัดส่งแล้ว" /> : <StatusPill tone="wait" label="รอจัดส่ง" />}
      </div>

      <div className="mt-[14px] flex items-start gap-[10px] rounded-xl px-4 py-[13px]" style={{ background: "rgba(95,212,255,0.06)", border: "1px solid rgba(95,212,255,0.2)" }}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: "var(--cyan)", flexShrink: 0, marginTop: 1 }}>
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6.5 10.2 L9 12.6 L13.5 7.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--steel)" }}>
          <strong style={{ color: "var(--white)", fontWeight: 500 }}>เงิน {formatTHB(order.amount)} ถูกพักไว้ที่ TCS แล้ว</strong> ปลอดภัยที่จะแพ็คและส่งได้เลย —
          เงินจะโอนเข้าบัญชีคุณทันทีที่ผู้ซื้อกดรับการ์ด หรือเมื่อครบกำหนดเวลาอนุมัติอัตโนมัติ
        </p>
      </div>

      <div className="section">
        <h2 className="mb-[14px] text-[14px] font-medium" style={{ color: "var(--steel)" }}>
          สถานะคำสั่งขาย
        </h2>
        <OrderTimeline steps={steps} />
      </div>

      <div className="section">
        <h2 className="mb-[14px] text-[14px] font-medium" style={{ color: "var(--steel)" }}>
          {isMeetup ? "การรับสินค้า" : "ที่อยู่จัดส่ง"}
        </h2>
        <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
          {isMeetup ? (
            <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
              <strong style={{ color: "var(--white)", fontWeight: 500 }}>ผู้ซื้อเลือกนัดรับ</strong> ไม่มีที่อยู่จัดส่ง
              นัดสถานที่และเวลาในแชทด้านล่าง แนะนำให้นัดในที่สาธารณะ
            </p>
          ) : order.shipping_address ? (
            <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
              <strong style={{ color: "var(--white)", fontWeight: 500 }}>{order.shipping_recipient}</strong> · <span className="mono">{order.shipping_phone}</span>
              <br />
              {order.shipping_address} {order.shipping_province} <span className="mono">{order.shipping_postcode}</span>
            </p>
          ) : (
            <p className="text-[13.5px]" style={{ color: "var(--steel)" }}>ยังไม่มีที่อยู่จัดส่งในคำสั่งซื้อนี้ สอบถามผู้ซื้อในแชท</p>
          )}
        </div>
      </div>

      <div className="section">
        {!shipped && isMeetup ? (
          <div className="rounded-2xl p-5" style={{ background: "var(--panel)", border: "1px solid rgba(95,212,255,0.2)" }}>
            <h3 className="text-[15px] font-medium">ยืนยันการส่งมอบ</h3>
            <p className="mt-[6px] max-w-[54ch] text-[13px] leading-relaxed" style={{ color: "var(--steel)" }}>
              กดหลังจากที่คุณส่งมอบการ์ดให้ผู้ซื้อแล้วเท่านั้น ผู้ซื้อจะถ่ายวิดีโอแกะกล่องแล้วกดรับ
              หากมีปัญหาผู้ซื้อยังเปิดข้อพิพาทได้ตามปกติ
            </p>
            {error && (
              <p className="mt-[10px] text-[12px]" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={handleHandover}
              disabled={submitting}
              className="mt-[18px] h-12 w-full rounded-[11px] text-[14.5px] font-semibold"
              style={{ background: "var(--blue)", color: "#071523" }}
            >
              {submitting ? "..." : "ยืนยันส่งมอบแล้ว"}
            </button>
          </div>
        ) : !shipped ? (
          <div className="rounded-2xl p-5" style={{ background: "var(--panel)", border: "1px solid rgba(95,212,255,0.2)" }}>
            <h3 className="text-[15px] font-medium">ยืนยันการจัดส่ง</h3>
            <p className="mt-[6px] max-w-[54ch] text-[13px] leading-relaxed" style={{ color: "var(--steel)" }}>
              กรอกบริษัทขนส่งและเลขพัสดุ ผู้ซื้อจะเห็นข้อมูลนี้ทันทีและติดตามสถานะได้เอง
            </p>
            <div className="mt-[14px] grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
              <div>
                <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
                  บริษัทขนส่ง
                </label>
                <select
                  value={courier}
                  onChange={(e) => { setCourier(e.target.value); setError(""); }}
                  className="h-11 w-full rounded-[10px] px-[13px] text-[14.5px] outline-none"
                  style={{ background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: courier ? "var(--white)" : "var(--steel-dim)" }}
                >
                  <option value="">เลือกบริษัทขนส่ง</option>
                  {COURIERS.map((c) => (
                    <option key={c} value={c} style={{ color: "var(--white)" }}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
                  เลขพัสดุ
                </label>
                <input
                  className="mono h-11 w-full rounded-[10px] px-[13px] text-[14.5px] outline-none"
                  style={{ background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--white)" }}
                  placeholder="TH0234998877XX"
                  value={tracking}
                  onChange={(e) => { setTracking(e.target.value); setError(""); }}
                />
              </div>
            </div>
            {error && (
              <p className="mt-[10px] text-[12px]" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="mt-[18px] h-12 w-full rounded-[11px] text-[14.5px] font-semibold"
              style={{ background: "var(--blue)", color: "#071523" }}
            >
              {submitting ? "..." : "ยืนยันการจัดส่ง"}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(79,201,122,0.25)" }}>
            <div className="flex items-center gap-[10px]">
              <div className="flex flex-shrink-0 items-center justify-center rounded-[9px]" style={{ width: 34, height: 34, background: "rgba(79,201,122,0.12)", color: "var(--good)" }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M4 10.5 L8 14.5 L16 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-medium" style={{ color: "var(--white)" }}>
                  ยืนยันการจัดส่งแล้ว
                </p>
                <p className="mono mt-[2px] text-[12px]" style={{ color: "var(--steel)" }}>
                  {isMeetup ? "ส่งมอบแล้ว · นัดรับ" : `${shippedInfo.courier} · ${shippedInfo.tracking}`}
                </p>
              </div>
            </div>
            <p className="mt-[14px] pt-[14px] text-[12.5px] leading-relaxed" style={{ borderTop: "1px solid rgba(140,147,163,0.12)", color: "var(--steel-dim)" }}>
              ผู้ซื้อได้รับแจ้งเตือนแล้ว คุณไม่ต้องทำอะไรเพิ่มจนกว่าผู้ซื้อจะยืนยันรับการ์ดหรือครบกำหนดเวลาอนุมัติอัตโนมัติ เงินจะโอนเข้าบัญชีคุณโดยอัตโนมัติหลังจากนั้น
            </p>
          </div>
        )}
      </div>

      <div className="section">
        <h2 className="mb-[14px] text-[14px] font-medium" style={{ color: "var(--steel)" }}>
          แชทกับผู้ซื้อ
        </h2>
        <ChatPanel
          initialMessages={messages}
          currentUserId={currentUserId}
          avatarFor={(senderId, isMe) => (isMe ? "คุณ" : maskUserLabel(senderId).slice(-3))}
          onSend={(body) => sendOrderMessage(order.id, body)}
        />
      </div>
    </>
  );
}
