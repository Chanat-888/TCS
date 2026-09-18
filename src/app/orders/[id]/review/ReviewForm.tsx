"use client";

import { useState } from "react";
import Link from "next/link";
import { ReviewItem } from "@/components/ReviewItem";
import { submitReview } from "./actions";

const RATING_LABELS: Record<number, string> = { 1: "แย่มาก", 2: "ไม่ค่อยดี", 3: "ปานกลาง", 4: "ดี", 5: "ดีมาก" };
const STAR_PATH = "M10 1.5l2.6 5.5 6 .7-4.4 4.1 1.2 6-5.4-3-5.4 3 1.2-6L1.4 7.7l6-.7z";
const TAGS = ["แพ็คดี", "ส่งไว", "ตรงปก", "ราคาคุ้มค่า", "ตอบแชทไว"];

export function ReviewForm({
  orderId,
  sellerId,
  sellerName,
  listingName,
  amount,
}: {
  orderId: string;
  sellerId: string;
  sellerName: string;
  listingName: string;
  amount: number;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [ratingError, setRatingError] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!rating) {
      setRatingError(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    const result = await submitReview(orderId, rating, tags, comment);
    setSubmitting(false);
    if ("error" in result) {
      setSubmitError(result.error ?? "เกิดข้อผิดพลาด ลองอีกครั้ง");
      return;
    }
    setDone(true);
    window.scrollTo({ top: 0 });
  }

  const shownValue = hover || rating;

  if (done) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto mb-4 flex items-center justify-center rounded-full" style={{ width: 56, height: 56, background: "rgba(79,201,122,0.12)", border: "1px solid rgba(79,201,122,0.35)", color: "var(--good)" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5 L9.5 17 L19 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-[1.4rem]">ขอบคุณสำหรับรีวิว</h1>
        <p className="mt-2 text-[14.5px]" style={{ color: "var(--steel)" }}>
          รีวิวของคุณแสดงบนโปรไฟล์ของ {sellerName} แล้ว
        </p>

        <p className="mt-6 text-left text-[12.5px]" style={{ color: "var(--steel-dim)" }}>
          ตัวอย่างที่จะแสดงบนโปรไฟล์ร้านค้า
        </p>
        <ReviewItem
          isFirst
          raterInitial="คุณ"
          raterName="คุณ"
          rating={rating}
          date="เมื่อสักครู่"
          text={comment || undefined}
          tags={tags}
          orderLabel={listingName}
        />

        <div className="mt-6 flex flex-wrap justify-center gap-[10px]">
          <Link href={`/profile/${sellerId}`} className="min-w-[160px] flex-1 rounded-[11px] py-3 text-center text-[14px] font-medium no-underline" style={{ background: "var(--blue)", color: "#071523" }}>
            ดูโปรไฟล์ร้านค้า
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
      <div className="flex flex-wrap items-center gap-[14px] rounded-2xl p-4" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
        <div className="flex flex-shrink-0 items-center justify-center rounded-[9px]" style={{ width: 48, height: 62, background: "var(--panel-2)", border: "1px solid rgba(95,212,255,0.25)" }}>
          <svg width="46%" height="46%" viewBox="0 0 64 64" aria-hidden="true">
            <path d="M32 4 L40 28 L64 28 L44 42 L52 64 L32 50 L12 64 L20 42 L0 28 L24 28 Z" fill="var(--cyan)" />
          </svg>
        </div>
        <div className="min-w-[160px] flex-1">
          <p className="text-[14px] font-medium" style={{ color: "var(--white)" }}>
            {listingName}
          </p>
          <p className="mt-[3px] text-[12px]" style={{ color: "var(--steel)" }}>
            จาก {sellerName} · ฿{amount.toLocaleString("en-US")}
          </p>
        </div>
        <span
          className="mono inline-flex flex-shrink-0 items-center gap-[6px] rounded-full px-[10px] py-1 text-[11px]"
          style={{ color: "var(--good)", background: "rgba(79,201,122,0.1)", border: "1px solid rgba(79,201,122,0.28)" }}
        >
          <svg width="11" height="11" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M4 10.5 L8 14.5 L16 5.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          เสร็จสมบูรณ์
        </span>
      </div>

      <div className="mt-[26px] text-center">
        <h2 className="text-[15px] font-medium" style={{ color: "var(--white)" }}>
          คุณให้คะแนนร้านนี้กี่ดาว
        </h2>
        <div className="mt-[18px] flex justify-center gap-2" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} ดาว`}
              onMouseEnter={() => setHover(n)}
              onClick={() => { setRating(n); setRatingError(false); }}
              className="border-0 bg-transparent p-1"
            >
              <svg width="38" height="38" viewBox="0 0 20 20" style={{ color: n <= shownValue ? "var(--gold)" : "var(--steel-dim)" }}>
                <path fill="currentColor" d={STAR_PATH} />
              </svg>
            </button>
          ))}
        </div>
        <p className="mt-3 min-h-[1.6em] text-[13.5px]" style={{ color: shownValue ? "var(--gold)" : "var(--steel)", fontWeight: shownValue ? 500 : 400 }}>
          {shownValue ? RATING_LABELS[shownValue] : "แตะดาวเพื่อให้คะแนน"}
        </p>
        {ratingError && (
          <p className="mt-[10px] text-[12px]" style={{ color: "var(--danger)" }}>
            เลือกจำนวนดาวก่อนส่งรีวิว
          </p>
        )}
      </div>

      <div className="mt-[26px]">
        <h2 className="mb-3 text-[14px] font-medium" style={{ color: "var(--steel)" }}>
          จุดเด่นของร้านนี้ (เลือกได้มากกว่า 1 ข้อ)
        </h2>
        <div className="flex flex-wrap gap-2">
          {TAGS.map((tag) => {
            const active = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setTags((prev) => (active ? prev.filter((t) => t !== tag) : [...prev, tag]))}
                className="rounded-full px-[14px] py-2 text-[13px]"
                style={{
                  background: active ? "rgba(95,212,255,0.1)" : "var(--panel)",
                  border: `1px solid ${active ? "var(--cyan)" : "rgba(140,147,163,0.2)"}`,
                  color: active ? "var(--cyan)" : "var(--steel)",
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-[26px]">
        <h2 className="mb-3 text-[14px] font-medium" style={{ color: "var(--steel)" }}>
          เขียนรีวิวเพิ่มเติม (ไม่บังคับ)
        </h2>
        <textarea
          maxLength={400}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="บอกเล่าประสบการณ์การซื้อขายครั้งนี้..."
          className="w-full resize-y rounded-[10px] p-3 text-[14px] leading-relaxed outline-none"
          style={{ background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--white)", minHeight: 100 }}
        />
      </div>

      <p className="mt-6 text-center text-[12px] leading-relaxed" style={{ color: "var(--steel-dim)" }}>
        รีวิวนี้มาจากคำสั่งซื้อที่เสร็จสมบูรณ์แล้วเท่านั้น และจะแสดงบนโปรไฟล์ของ {sellerName} ให้ทุกคนเห็น
      </p>

      {submitError && (
        <p className="mt-3 text-center text-[12.5px]" style={{ color: "var(--danger)" }}>
          {submitError}
        </p>
      )}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-[18px] h-[52px] w-full rounded-xl text-[15.5px] font-semibold"
        style={{ background: "var(--blue)", color: "#071523" }}
      >
        {submitting ? "..." : "ส่งรีวิว"}
      </button>
    </>
  );
}
