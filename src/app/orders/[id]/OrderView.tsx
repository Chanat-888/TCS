"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrderTimeline, type TimelineStep } from "@/components/OrderTimeline";
import { StatusPill } from "@/components/StatusPill";
import { ChatPanel } from "@/components/ChatPanel";
import { Countdown } from "@/components/Countdown";
import { secondsUntil } from "@/lib/countdown";
import { formatTHB, formatRelativeTime } from "@/lib/format";
import type { Message, Order } from "@/lib/supabase/types";
import { approveOrder, sendOrderMessage } from "./actions";

const TRUCK_ICON = (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M3 6h9l5 4v6H3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="7" cy="16" r="1.6" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="15" cy="16" r="1.6" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);
const VIDEO_ICON = (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="3" y="6" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M13 9 L17 7 V13 L13 11" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

export function OrderView({
  order,
  listingName,
  sellerId,
  sellerName,
  messages,
  currentUserId,
}: {
  order: Order;
  listingName: string;
  sellerId: string;
  sellerName: string;
  messages: Message[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(order.status);
  const [deliveredAt, setDeliveredAt] = useState(order.delivered_at);
  const [videoUrl, setVideoUrl] = useState(order.unboxing_video_url);
  const [videoFilename, setVideoFilename] = useState<string | null>(order.unboxing_video_url ? "unboxing.mp4" : null);
  const [autoApproveAt, setAutoApproveAt] = useState(order.auto_approve_at);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const hasVideo = Boolean(videoUrl);
  const awaitingDecision = status === "DELIVERED" && hasVideo;

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError("");
    const formData = new FormData();
    formData.append("video", file);
    const res = await fetch(`/api/orders/${order.id}/video`, { method: "POST", body: formData });
    const json = await res.json();
    setUploading(false);
    if (!res.ok) {
      setUploadError(json.error ?? "อัปโหลดไม่สำเร็จ");
      return;
    }
    setVideoUrl(json.url);
    setVideoFilename(json.filename);
    setAutoApproveAt(json.autoApproveAt);
    setDeliveredAt(json.deliveredAt);
    setStatus("DELIVERED");
  }

  async function handleApprove() {
    setApproving(true);
    setApproveError("");
    const result = await approveOrder(order.id);
    setApproving(false);
    if ("error" in result) {
      setApproveError(result.error ?? "เกิดข้อผิดพลาด ลองอีกครั้ง");
      return;
    }
    setStatus("COMPLETED");
  }

  const steps: TimelineStep[] = [
    { label: "เงินถูกพักไว้", state: "done", meta: <>คุณชำระเงินแล้ว · <span className="mono">{order.paid_at ? formatRelativeTime(order.paid_at) : ""}</span></> },
    {
      label: "ผู้ขายส่งของแล้ว",
      state: order.shipped_at ? "done" : "active",
      icon: TRUCK_ICON,
      meta: order.shipped_at ? (
        <>
          {order.delivery_method === "meetup" ? "ส่งมอบแล้ว (นัดรับ)" : <>{order.courier} · เลขพัสดุ <span className="mono">{order.tracking_number}</span></>} · <span className="mono">{formatRelativeTime(order.shipped_at)}</span>
        </>
      ) : (
        order.delivery_method === "meetup" ? "นัดสถานที่และเวลากับผู้ขายในแชท แล้วรอผู้ขายกดยืนยันส่งมอบ" : "รอผู้ขายจัดส่งสินค้า"
      ),
    },
    {
      label: "พัสดุถึงมือคุณแล้ว",
      state: deliveredAt ? "done" : order.shipped_at ? "active" : "pending",
      meta: deliveredAt ? <>ยืนยันแล้ว · <span className="mono">{formatRelativeTime(deliveredAt)}</span></> : "ถ่ายวิดีโอแกะกล่องเพื่อยืนยันว่าได้รับพัสดุแล้ว",
    },
    {
      label: "ถ่ายวิดีโอแกะกล่อง",
      state: hasVideo ? "done" : order.shipped_at ? "active" : "pending",
      icon: VIDEO_ICON,
      meta: "จำเป็นก่อนกดรับการ์ดหรือเปิดข้อพิพาท",
    },
    {
      label: "กดรับการ์ด",
      state: status === "COMPLETED" ? "done" : awaitingDecision ? "active" : "pending",
      meta: "เงินจะโอนให้ผู้ขายทันทีที่คุณกดรับ",
    },
  ];

  const statusPill =
    status === "COMPLETED" ? (
      <StatusPill tone="done" label="เสร็จสมบูรณ์" />
    ) : status === "DISPUTED" ? (
      <StatusPill tone="danger" label="อยู่ระหว่างข้อพิพาท" />
    ) : awaitingDecision ? (
      <StatusPill tone="wait" label="รอคุณอนุมัติ" />
    ) : order.shipped_at ? (
      <StatusPill tone="wait" label="รอวิดีโอแกะกล่อง" />
    ) : (
      <StatusPill tone="wait" label="รอจัดส่ง" />
    );

  return (
    <>
      <div className="flex flex-wrap items-center gap-[14px] rounded-2xl p-4" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
        <div
          className="flex flex-shrink-0 items-center justify-center rounded-[9px]"
          style={{ width: 52, height: 68, background: "var(--panel-2)", border: "1px solid rgba(95,212,255,0.25)" }}
        >
          <svg width="46%" height="46%" viewBox="0 0 64 64" aria-hidden="true">
            <path d="M32 4 L40 28 L64 28 L44 42 L52 64 L32 50 L12 64 L20 42 L0 28 L24 28 Z" fill="var(--cyan)" />
          </svg>
        </div>
        <div className="min-w-[160px] flex-1">
          <p className="text-[14.5px] font-medium" style={{ color: "var(--white)" }}>
            {listingName}
          </p>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--steel)" }}>
            จาก <Link href={`/profile/${sellerId}`} style={{ color: "var(--steel)" }}>{sellerName}</Link> · {formatTHB(order.amount)}
          </p>
        </div>
        {statusPill}
      </div>

      <div className="section">
        <h2 className="mb-[14px] text-[14px] font-medium" style={{ color: "var(--steel)" }}>
          สถานะการจัดส่ง
        </h2>
        <OrderTimeline steps={steps} />
      </div>

      {!hasVideo && order.shipped_at && status !== "DISPUTED" && (
        <div className="section">
          <div className="rounded-2xl p-5" style={{ background: "var(--panel)", border: "1px solid rgba(95,212,255,0.2)" }}>
            <h3 className="text-[15px] font-medium">ถ่ายวิดีโอแกะกล่อง</h3>
            <p className="mt-[6px] max-w-[54ch] text-[13px] leading-relaxed" style={{ color: "var(--steel)" }}>
              อัปโหลดวิดีโอตอนแกะกล่องก่อนกดรับการ์ด — เป็นหลักฐานเดียวที่ใช้เปิดข้อพิพาทได้ ไม่มีวิดีโอ ไม่มีสิทธิ์เปิดข้อพิพาท
            </p>
            <input
              ref={fileInput}
              type="file"
              accept="video/mp4,video/quicktime"
              hidden
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="mt-4 w-full rounded-xl py-[26px] text-center transition-colors"
              style={{ border: "1.5px dashed rgba(95,212,255,0.3)" }}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className={`mx-auto ${uploading ? "animate-spin" : ""}`}
                style={{ color: "var(--cyan)" }}
              >
                <path d="M12 16V4M12 4l-4 4M12 4l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <p className="mt-[10px] text-[13.5px] font-medium" style={{ color: "var(--white)" }}>
                {uploading ? "กำลังอัปโหลด..." : "แตะเพื่ออัปโหลดวิดีโอ"}
              </p>
              <p className="mt-[3px] text-[12px]" style={{ color: "var(--steel-dim)" }}>
                MP4 หรือ MOV · ไม่เกิน 200MB
              </p>
            </button>
            {uploadError && (
              <p className="mt-2 text-[12.5px]" style={{ color: "var(--danger)" }}>
                {uploadError}
              </p>
            )}
          </div>
        </div>
      )}

      {hasVideo && status !== "COMPLETED" && (
        <div className="section">
          <div
            className="flex items-center gap-3 rounded-xl p-[14px]"
            style={{ background: "var(--panel-2)", border: "1px solid rgba(79,201,122,0.3)" }}
          >
            <div className="flex flex-shrink-0 items-center justify-center rounded-[9px]" style={{ width: 36, height: 36, background: "rgba(79,201,122,0.12)", color: "var(--good)" }}>
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 10.5 L8 14.5 L16 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-[13.5px] font-medium" style={{ color: "var(--white)" }}>
                {videoFilename}
              </p>
              <p className="mt-[2px] text-[11.5px]" style={{ color: "var(--steel-dim)" }}>
                อัปโหลดสำเร็จ
              </p>
            </div>
          </div>
        </div>
      )}

      {awaitingDecision && (
        <div className="mt-[22px] rounded-2xl p-5" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
          <h3 className="text-[15px]">คุณพอใจกับการ์ดที่ได้รับหรือไม่</h3>
          {autoApproveAt && (
            <p className="mt-2 flex items-center gap-2 text-[12.5px]" style={{ color: "var(--steel)" }}>
              ระบบจะอนุมัติให้อัตโนมัติใน{" "}
              <span className="mono" style={{ color: "var(--cyan)" }}>
                <Countdown endsAt={autoApproveAt} initialSeconds={secondsUntil(autoApproveAt)} onExpire={() => router.refresh()} />
              </span>{" "}
              หากไม่มีการดำเนินการ
            </p>
          )}
          <div className="mt-4 flex items-start gap-[10px] rounded-xl px-[15px] py-[13px]" style={{ background: "rgba(95,212,255,0.06)", border: "1px solid rgba(95,212,255,0.2)" }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: "var(--cyan)", flexShrink: 0, marginTop: 1 }}>
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
              <path d="M6.5 10.2 L9 12.6 L13.5 7.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--steel)" }}>
              <strong style={{ color: "var(--white)", fontWeight: 500 }}>กดรับ</strong> เงิน {formatTHB(order.amount)} จะโอนให้ {sellerName} ทันที ·{" "}
              <strong style={{ color: "var(--white)", fontWeight: 500 }}>เปิดข้อพิพาท</strong> ภายใน 48 ชม. แอดมินจะเทียบรูปสินค้ากับวิดีโอแกะกล่องแล้วตัดสิน
            </p>
          </div>
          {approveError && (
            <p className="mt-2 text-[12.5px]" style={{ color: "var(--danger)" }}>
              {approveError}
            </p>
          )}
          <div className="mt-[18px] flex flex-wrap gap-[10px]">
            <button
              type="button"
              onClick={handleApprove}
              disabled={approving}
              className="h-12 min-w-[160px] flex-1 rounded-[11px] text-[14.5px] font-semibold"
              style={{ background: "var(--blue)", color: "#071523" }}
            >
              {approving ? "..." : "กดรับการ์ด"}
            </button>
            <Link
              href={`/orders/${order.id}/dispute`}
              className="flex h-12 min-w-[160px] flex-1 items-center justify-center rounded-[11px] text-center text-[14.5px] font-semibold no-underline"
              style={{ border: "1.5px solid rgba(232,102,79,0.4)", color: "var(--danger)" }}
            >
              เปิดข้อพิพาท
            </Link>
          </div>
        </div>
      )}

      {status === "COMPLETED" && (
        <div className="mt-[22px] rounded-2xl p-7 text-center" style={{ background: "var(--panel)", border: "1px solid rgba(79,201,122,0.25)" }}>
          <div className="mx-auto mb-[14px] flex items-center justify-center rounded-full" style={{ width: 52, height: 52, background: "rgba(79,201,122,0.12)", border: "1px solid rgba(79,201,122,0.35)", color: "var(--good)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12.5 L9.5 17 L19 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-[1.2rem]">คำสั่งซื้อเสร็จสมบูรณ์</h2>
          <p className="mx-auto mt-2 max-w-[42ch] text-[13.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
            เงิน {formatTHB(order.amount)} โอนให้ {sellerName} เรียบร้อยแล้ว ขอบคุณที่ซื้อขายผ่าน TCS
          </p>
          <Link
            href={`/orders/${order.id}/review`}
            className="mt-[18px] inline-block rounded-[10px] px-[22px] py-[11px] text-[13.5px] font-semibold no-underline"
            style={{ background: "var(--blue)", color: "#071523" }}
          >
            ให้คะแนนร้านค้า
          </Link>
        </div>
      )}

      <div className="section">
        <h2 className="mb-[14px] text-[14px] font-medium" style={{ color: "var(--steel)" }}>
          แชทกับผู้ขาย
        </h2>
        <ChatPanel
          orderId={order.id}
          initialMessages={messages}
          currentUserId={currentUserId}
          avatarFor={(senderId, isMe) => (isMe ? "คุณ" : sellerName.slice(0, 2).toUpperCase())}
          onSend={sendOrderMessage}
        />
      </div>
    </>
  );
}
