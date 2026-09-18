import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUserId } from "@/lib/session";
import { getDisputeDetail, getMessagesForOrder } from "@/lib/orders";
import { Footer } from "@/components/Footer";
import { formatTHB, formatRelativeTime, maskUserLabel } from "@/lib/format";
import { DISPUTE_REASON_LABELS } from "@/lib/disputeReasons";
import { DecisionPanel } from "./DecisionPanel";
import { VideoEvidenceBox } from "./VideoEvidenceBox";

export default async function AdminDisputePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const detail = await getDisputeDetail(id, userId);
  if (!detail) notFound();

  const messages = await getMessagesForOrder(detail.order.id);
  const buyerMask = maskUserLabel(detail.buyer.id);

  const evidenceCaption = (label: string, src: string) => (
    <p className="mb-2 text-[12px] font-medium" style={{ color: "var(--steel)" }}>
      {label}
      <span className="mt-[1px] block text-[10.5px] font-normal" style={{ color: "var(--steel-dim)" }}>
        {src}
      </span>
    </p>
  );

  return (
    <div style={{ "--wrap-max": "1160px" } as CSSProperties}>
      <header
        className="sticky top-0 z-50"
        style={{ background: "rgba(10, 12, 16, 0.78)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid rgba(140, 147, 163, 0.1)" }}
      >
        <div className="wrap flex items-center gap-[14px] py-[14px]">
          <Link
            href="/browse"
            aria-label="กลับ"
            className="flex flex-shrink-0 items-center justify-center rounded-[10px] no-underline"
            style={{ width: 40, height: 40, background: "var(--panel)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--steel)" }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M12.5 4 L6 10 L12.5 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="min-w-0">
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--white)" }}>ตรวจสอบข้อพิพาท</p>
            <p className="mono text-[11px]" style={{ color: "var(--steel-dim)" }}>
              คำสั่งซื้อ #{detail.order.order_code}
            </p>
          </div>
          <span
            className="mono ml-auto flex-shrink-0 rounded-full px-[10px] py-1 text-[10.5px]"
            style={{ color: "var(--gold)", background: "rgba(232,184,79,0.1)", border: "1px solid rgba(232,184,79,0.3)" }}
          >
            ADMIN
          </span>
        </div>
      </header>

      <main className="py-7 pb-[70px]">
        <div className="wrap grid gap-7 max-[880px]:grid-cols-1" style={{ gridTemplateColumns: "1.4fr 1fr", alignItems: "start" }}>
          <div className="flex flex-col gap-[22px]">
            <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
              <h2 className="mb-[14px] text-[14px] font-medium" style={{ color: "var(--steel)" }}>
                สรุปคำสั่งซื้อ
              </h2>
              <div className="flex flex-wrap items-center gap-[14px]">
                <div className="flex flex-shrink-0 items-center justify-center rounded-[9px]" style={{ width: 48, height: 62, background: "var(--panel-2)", border: "1px solid rgba(95,212,255,0.25)" }}>
                  <svg width="46%" height="46%" viewBox="0 0 64 64" aria-hidden="true">
                    <path d="M32 4 L40 28 L64 28 L44 42 L52 64 L32 50 L12 64 L20 42 L0 28 L24 28 Z" fill="var(--cyan)" />
                  </svg>
                </div>
                <div className="min-w-[160px] flex-1">
                  <p className="text-[14.5px] font-medium" style={{ color: "var(--white)" }}>
                    {detail.listing.name}
                  </p>
                  <p className="mt-1 text-[12.5px]" style={{ color: "var(--steel)" }}>
                    ยื่นข้อพิพาทเมื่อ <span className="mono">{formatRelativeTime(detail.dispute.created_at)}</span>
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
              <div className="mt-4 grid grid-cols-2 gap-3 pt-4 max-[420px]:grid-cols-1" style={{ borderTop: "1px solid rgba(140,147,163,0.12)" }}>
                <div>
                  <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--steel-dim)" }}>
                    ผู้ซื้อ
                  </p>
                  <p className="mt-[3px] text-[13.5px] font-medium" style={{ color: "var(--white)" }}>
                    {buyerMask}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--steel-dim)" }}>
                    ผู้ขาย
                  </p>
                  <p className="mt-[3px] text-[13.5px] font-medium" style={{ color: "var(--white)" }}>
                    <Link href={`/profile/${detail.seller.id}`} style={{ color: "inherit" }}>
                      {detail.seller.display_name}
                    </Link>
                  </p>
                </div>
              </div>
              <span
                className="mt-[14px] inline-flex items-center gap-[6px] rounded-full px-3 py-[5px] text-[12px]"
                style={{ color: "var(--danger)", background: "rgba(232,102,79,0.1)", border: "1px solid rgba(232,102,79,0.28)" }}
              >
                {DISPUTE_REASON_LABELS[detail.dispute.reason]}
              </span>
            </div>

            <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
              <h2 className="mb-[14px] text-[14px] font-medium" style={{ color: "var(--steel)" }}>
                คำชี้แจงจากผู้ซื้อ
              </h2>
              <p className="text-[14px] leading-loose" style={{ color: "var(--steel)" }}>
                &ldquo;{detail.dispute.description || "ไม่ได้ระบุรายละเอียดเพิ่มเติม"}&rdquo;
              </p>
            </div>

            <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
              <h2 className="mb-[14px] text-[14px] font-medium" style={{ color: "var(--steel)" }}>
                หลักฐาน — เทียบรูปประกาศขายกับวิดีโอแกะกล่อง
              </h2>
              <div className="grid grid-cols-3 gap-3 max-[640px]:grid-cols-1">
                <div>
                  {evidenceCaption("รูปประกาศขาย (หน้า)", "จากผู้ขาย ตอนลงประกาศ")}
                  <div className="flex items-center justify-center rounded-xl" style={{ aspectRatio: "5 / 6.2", background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.18)" }}>
                    <svg width="30%" height="30%" viewBox="0 0 64 64" aria-hidden="true">
                      <path d="M32 4 L40 28 L64 28 L44 42 L52 64 L32 50 L12 64 L20 42 L0 28 L24 28 Z" fill="var(--blue)" opacity={0.85} />
                    </svg>
                  </div>
                </div>
                <div>
                  {evidenceCaption("รูปประกาศขาย (หลัง)", "จากผู้ขาย ตอนลงประกาศ")}
                  <div className="flex items-center justify-center rounded-xl" style={{ aspectRatio: "5 / 6.2", background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.18)" }}>
                    <svg width="30%" height="30%" viewBox="0 0 64 64" aria-hidden="true">
                      <path d="M32 6 L40.8 25.2 L32 44.4 L23.2 25.2 Z" fill="var(--blue)" opacity={0.85} />
                    </svg>
                  </div>
                </div>
                <div>
                  {evidenceCaption("วิดีโอแกะกล่อง", "จากผู้ซื้อ · 48 วินาที")}
                  <VideoEvidenceBox videoUrl={detail.order.unboxing_video_url ?? ""} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
              <h2 className="mb-[14px] text-[14px] font-medium" style={{ color: "var(--steel)" }}>
                ประวัติแชทของคำสั่งซื้อนี้
              </h2>
              <div className="flex flex-col gap-3">
                {messages.map((msg) => {
                  const isSeller = msg.sender_id === detail.seller.id;
                  return (
                    <div key={msg.id} className={`flex max-w-[88%] gap-[10px] ${isSeller ? "flex-row-reverse self-end" : ""}`}>
                      <div className="flex flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold" style={{ width: 26, height: 26, background: "var(--panel-2)", color: "var(--steel)", fontFamily: "var(--font-display)" }}>
                        {isSeller ? detail.seller.avatar_initial : buyerMask.slice(-3)}
                      </div>
                      <div>
                        <div className="rounded-xl px-3 py-2 text-[13px] leading-relaxed" style={{ background: isSeller ? "var(--blue-dim)" : "var(--panel-2)", color: "var(--white)" }}>
                          {msg.body}
                        </div>
                        <span className="mono mt-1 block text-[10px]" style={{ color: "var(--steel-dim)" }}>
                          {new Date(msg.created_at).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:sticky lg:top-[88px]">
            <DecisionPanel disputeId={detail.dispute.id} amount={detail.order.amount} sellerName={detail.seller.display_name} />
          </div>
        </div>
      </main>

      <Footer note="เอกสารแนวคิดฉบับพรีวิว — เครื่องมือแอดมินเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
