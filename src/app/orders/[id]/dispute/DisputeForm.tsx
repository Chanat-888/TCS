"use client";

import { useState } from "react";
import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { secondsUntil } from "@/lib/countdown";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { DisputeReason } from "@/lib/supabase/types";
import { fileDispute } from "./actions";

const REASONS: { key: DisputeReason; label: string; sub: string }[] = [
  { key: "condition", label: "สภาพการ์ดไม่ตรงกับที่ประกาศขาย", sub: "เช่น มีรอยขีดข่วน มุมช้ำ ที่ไม่ได้ระบุไว้ในประกาศ" },
  { key: "wrong", label: "ได้รับการ์ดผิดใบ", sub: "การ์ดที่ได้รับไม่ใช่ใบที่ประมูลหรือซื้อไว้" },
  { key: "authenticity", label: "สงสัยว่าการ์ดไม่ใช่ของแท้", sub: "ลักษณะการ์ดผิดปกติ สงสัยว่าเป็นของปลอม" },
  { key: "other", label: "อื่นๆ", sub: "ระบุรายละเอียดเพิ่มเติมด้านล่าง" },
];

export function DisputeForm({
  orderId,
  orderCode,
  autoApproveAt,
  videoFilename,
}: {
  orderId: string;
  orderCode: string;
  autoApproveAt: string;
  videoFilename: string;
}) {
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [reasonError, setReasonError] = useState(false);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!reason) {
      setReasonError(true);
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    const result = await fileDispute(orderId, reason, description);
    setSubmitting(false);
    if ("error" in result) {
      setSubmitError(result.error ?? "เกิดข้อผิดพลาด ลองอีกครั้ง");
      return;
    }
    setDone(true);
    window.scrollTo({ top: 0 });
  }

  if (done) {
    return (
      <div className="py-9 text-center">
        <div
          className="mx-auto mb-4 flex items-center justify-center rounded-full"
          style={{ width: 58, height: 58, background: "rgba(95,212,255,0.1)", border: "1px solid rgba(95,212,255,0.3)", color: "var(--cyan)" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5 L9.5 17 L19 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-[1.5rem]">ส่งข้อพิพาทแล้ว</h1>
        <p className="mx-auto mt-[10px] max-w-[44ch] text-[14.5px] leading-loose" style={{ color: "var(--steel)" }}>
          เรื่องข้อพิพาทของคำสั่งซื้อ <strong className="mono" style={{ color: "var(--white)" }}>#{orderCode}</strong> ถูกส่งให้แอดมินแล้ว
          เงินยังคงถูกพักไว้ที่ TCS จนกว่าจะมีผลตัดสิน
        </p>
        <span
          className="mono mt-4 inline-flex items-center gap-[7px] rounded-full px-[15px] py-[7px] text-[12.5px]"
          style={{ color: "var(--danger)", background: "rgba(232,102,79,0.1)", border: "1px solid rgba(232,102,79,0.3)" }}
        >
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="4" fill="currentColor" />
          </svg>
          DISPUTED
        </span>
        <div className="mt-[26px] rounded-2xl p-[18px] text-left" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
          <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
            <strong style={{ color: "var(--white)", fontWeight: 500 }}>ต่อไป:</strong> แอดมินจะตรวจสอบรูปสินค้า วิดีโอแกะกล่อง และประวัติแชทของคำสั่งซื้อนี้
            คุณจะได้รับแจ้งเตือนทันทีที่มีผลตัดสิน ภายใน 2 วันทำการ
          </p>
        </div>
        <div className="mt-[22px] flex flex-wrap justify-center gap-[10px]">
          <Link href={`/orders/${orderId}`} className="min-w-[160px] flex-1 rounded-[11px] py-3 text-center text-[14px] font-medium no-underline" style={{ background: "var(--blue)", color: "#071523" }}>
            กลับไปดูคำสั่งซื้อ
          </Link>
          <Link href="/browse" className="min-w-[160px] flex-1 rounded-[11px] py-3 text-center text-[14px] font-medium no-underline" style={{ background: "transparent", border: "1px solid rgba(140,147,163,0.25)", color: "var(--steel)" }}>
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mt-[14px] flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-[13px]" style={{ background: "rgba(95,212,255,0.06)", border: "1px solid rgba(95,212,255,0.2)" }}>
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
          เปิดข้อพิพาทได้ภายในเวลาที่กำหนดหลังได้รับพัสดุ <strong style={{ color: "var(--white)", fontWeight: 500 }}>เกินเวลานี้ระบบจะอนุมัติให้ผู้ขายอัตโนมัติ</strong>
        </p>
        <div className="mono flex flex-shrink-0 items-center gap-[7px] text-[16px]" style={{ color: "var(--cyan)" }}>
          <span className="rounded-full" style={{ width: 6, height: 6, background: "var(--cyan)", boxShadow: "0 0 8px 1px var(--cyan)" }} />
          <Countdown endsAt={autoApproveAt} initialSeconds={secondsUntil(autoApproveAt)} />
        </div>
      </div>

      <div className="mt-[22px]">
        <h2 className="mb-3 text-[14px] font-medium" style={{ color: "var(--steel)" }}>
          ปัญหาที่พบคืออะไร
        </h2>
        <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
          <div className="flex flex-col gap-[10px]">
            {REASONS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => { setReason(r.key); setReasonError(false); }}
                className="flex items-start gap-3 rounded-xl px-[14px] py-[13px] text-left"
                style={{ background: reason === r.key ? "rgba(95,212,255,0.05)" : "var(--panel-2)", border: `1.5px solid ${reason === r.key ? "var(--cyan)" : "rgba(140,147,163,0.18)"}` }}
              >
                <span className="mt-[1px] flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: 18, height: 18, border: `1.5px solid ${reason === r.key ? "var(--cyan)" : "rgba(140,147,163,0.4)"}` }}>
                  {reason === r.key && <span className="rounded-full" style={{ width: 9, height: 9, background: "var(--cyan)" }} />}
                </span>
                <div>
                  <p className="text-[14px] font-medium" style={{ color: "var(--white)" }}>
                    {r.label}
                  </p>
                  <p className="mt-[2px] text-[12px] leading-relaxed" style={{ color: "var(--steel-dim)" }}>
                    {r.sub}
                  </p>
                </div>
              </button>
            ))}
          </div>
          {reasonError && (
            <p className="mt-2 text-[12px]" style={{ color: "var(--danger)" }}>
              เลือกเหตุผลอย่างน้อยหนึ่งข้อก่อนดำเนินการต่อ
            </p>
          )}
        </div>
      </div>

      <div className="mt-[22px]">
        <h2 className="mb-3 text-[14px] font-medium" style={{ color: "var(--steel)" }}>
          อธิบายเพิ่มเติม
        </h2>
        <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
          <textarea
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="อธิบายปัญหาที่พบให้ละเอียด ช่วยให้แอดมินตัดสินได้เร็วขึ้น (ไม่บังคับ)"
            className="w-full resize-y rounded-[10px] p-[11px] text-[14px] leading-relaxed outline-none"
            style={{ background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--white)", minHeight: 92 }}
          />
          <p className="mono mt-[6px] text-right text-[11px]" style={{ color: "var(--steel-dim)" }}>
            {description.length} / 500
          </p>
        </div>
      </div>

      <div className="mt-[22px]">
        <h2 className="mb-3 text-[14px] font-medium" style={{ color: "var(--steel)" }}>
          หลักฐาน
        </h2>
        <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
          <div className="flex items-center gap-3 rounded-xl p-[14px]" style={{ background: "var(--panel-2)", border: "1px solid rgba(79,201,122,0.3)" }}>
            <div className="flex flex-shrink-0 items-center justify-center rounded-[9px]" style={{ width: 36, height: 36, background: "rgba(79,201,122,0.12)", color: "var(--good)" }}>
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="3" y="6" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M13 9 L17 7 V13 L13 11" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-[13.5px] font-medium" style={{ color: "var(--white)" }}>
                {videoFilename}
              </p>
              <p className="mt-[2px] text-[11.5px]" style={{ color: "var(--steel-dim)" }}>
                วิดีโอแกะกล่อง · แนบอัตโนมัติจากคำสั่งซื้อนี้
              </p>
            </div>
          </div>
          <p className="mt-[10px] text-[12px] leading-relaxed" style={{ color: "var(--steel-dim)" }}>
            แอดมินจะเทียบรูปสินค้าจากประกาศขายกับวิดีโอแกะกล่องนี้
          </p>
        </div>
      </div>

      <div className="mt-[22px]">
        <h2 className="mb-3 text-[14px] font-medium" style={{ color: "var(--steel)" }}>
          เกิดอะไรขึ้นต่อไป
        </h2>
        <div className="rounded-2xl p-[18px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
          <div className="flex flex-col gap-[10px]">
            {[
              "เงินยังคงถูกพักไว้ที่ TCS — ผู้ขายจะยังไม่ได้รับเงินจนกว่าจะมีผลตัดสิน",
              "แอดมินเทียบรูปสินค้าจากประกาศขายกับวิดีโอแกะกล่อง และอ่านประวัติแชทของคำสั่งซื้อนี้",
              "ได้รับผลภายใน 2 วันทำการ — แอดมินจะคืนเงินให้คุณ หรือโอนให้ผู้ขาย ขึ้นอยู่กับหลักฐาน",
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-[10px]">
                <span
                  className="mono mt-[1px] flex flex-shrink-0 items-center justify-center rounded-full text-[10.5px]"
                  style={{ width: 20, height: 20, background: "rgba(95,212,255,0.1)", border: "1px solid rgba(95,212,255,0.25)", color: "var(--cyan)" }}
                >
                  {i + 1}
                </span>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--steel)" }}>
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {submitError && (
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--danger)" }}>
          {submitError}
        </p>
      )}
      <div className="mt-6">
        <PrimaryButton height={52} variant="danger" loading={submitting} onClick={handleSubmit}>
          ส่งเรื่องข้อพิพาท
        </PrimaryButton>
      </div>
      <Link href={`/orders/${orderId}`} className="mt-[14px] block text-center text-[13px] no-underline" style={{ color: "var(--steel)" }}>
        ยกเลิก กลับไปคำสั่งซื้อ
      </Link>
    </>
  );
}
