import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUserId } from "@/lib/session";
import { getOrderDetail } from "@/lib/orders";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { formatTHB } from "@/lib/format";
import { DisputeForm } from "./DisputeForm";

export default async function DisputePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const detail = await getOrderDetail(id, userId);
  if (!detail || !detail.isBuyer) notFound();
  if (!detail.order.unboxing_video_url || detail.order.status !== "DELIVERED") {
    redirect(`/orders/${id}`);
  }

  return (
    <div style={{ "--wrap-max": "640px" } as CSSProperties}>
      <BackHeader href={`/orders/${id}`} title="เปิดข้อพิพาท" />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          <div className="flex flex-wrap items-center gap-[14px] rounded-2xl p-4" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
            <div className="flex flex-shrink-0 items-center justify-center rounded-[9px]" style={{ width: 52, height: 68, background: "var(--panel-2)", border: "1px solid rgba(95,212,255,0.25)" }}>
              <svg width="46%" height="46%" viewBox="0 0 64 64" aria-hidden="true">
                <path d="M32 4 L40 28 L64 28 L44 42 L52 64 L32 50 L12 64 L20 42 L0 28 L24 28 Z" fill="var(--cyan)" />
              </svg>
            </div>
            <div className="min-w-[160px] flex-1">
              <p className="text-[14.5px] font-medium" style={{ color: "var(--white)" }}>
                {detail.listing.name}
              </p>
              <p className="mt-1 text-[12.5px]" style={{ color: "var(--steel)" }}>
                จาก <Link href={`/profile/${detail.seller.id}`} style={{ color: "var(--steel)" }}>{detail.seller.display_name}</Link> · คำสั่งซื้อ{" "}
                <span className="mono">#{detail.order.order_code}</span>
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-[11px]" style={{ color: "var(--steel-dim)" }}>
                ยอดเงินที่พักไว้
              </p>
              <p className="mono mt-[2px] text-[16px]" style={{ color: "var(--white)" }}>
                {formatTHB(detail.order.amount)}
              </p>
            </div>
          </div>

          <DisputeForm
            orderId={id}
            orderCode={detail.order.order_code}
            autoApproveAt={detail.order.auto_approve_at ?? new Date().toISOString()}
            videoFilename="unboxing.mp4"
          />
        </div>
      </main>
      <Footer note="เอกสารแนวคิดฉบับพรีวิว — การส่งข้อพิพาทเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
