"use client";

import { useState } from "react";
import { formatTHB } from "@/lib/format";
import type { DisputeDecision } from "@/lib/supabase/types";
import { resolveDispute } from "./actions";

export function DecisionPanel({
  disputeId,
  amount,
  sellerName,
}: {
  disputeId: string;
  amount: number;
  sellerName: string;
}) {
  const [outcome, setOutcome] = useState<DisputeDecision | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resolved, setResolved] = useState<{ decision: DisputeDecision; note: string } | null>(null);

  async function handleConfirm() {
    if (!outcome || !note.trim()) {
      setError("เลือกผลการตัดสินและกรอกเหตุผลก่อนยืนยัน");
      return;
    }
    setSubmitting(true);
    setError("");
    const result = await resolveDispute(disputeId, outcome, note);
    setSubmitting(false);
    if ("error" in result) {
      setError(result.error ?? "เกิดข้อผิดพลาด ลองอีกครั้ง");
      return;
    }
    setResolved({ decision: outcome, note });
  }

  if (resolved) {
    return (
      <div className="rounded-2xl p-[18px] text-center" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
        <div className="mx-auto mb-[14px] flex items-center justify-center rounded-full" style={{ width: 48, height: 48, background: "rgba(79,201,122,0.12)", border: "1px solid rgba(79,201,122,0.35)", color: "var(--good)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5 L9.5 17 L19 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-[16px]">ตัดสินคดีแล้ว</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
          {resolved.decision === "refund" ? (
            <>เงิน {formatTHB(amount)} คืนเข้าบัญชีผู้ซื้อแล้ว</>
          ) : (
            <>เงิน {formatTHB(amount)} โอนเข้าบัญชี {sellerName} แล้ว</>
          )}
        </p>
        <div className="mt-[14px] rounded-[10px] p-[12px] text-left text-[12.5px] leading-relaxed" style={{ background: "var(--panel-2)", color: "var(--steel)" }}>
          <p className="mb-[5px] text-[11px]" style={{ color: "var(--steel-dim)" }}>
            บันทึกเหตุผล
          </p>
          <p>{resolved.note}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--panel)", border: "1px solid rgba(95,212,255,0.2)" }}>
      <h2 className="mb-[6px] text-[15px] font-medium" style={{ color: "var(--white)" }}>
        ตัดสินคดี
      </h2>
      <p className="mb-4 text-[12.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
        เลือกผลการตัดสินตามหลักฐานที่มี บันทึกเหตุผลไว้ ผู้ซื้อและผู้ขายจะเห็นข้อความนี้
      </p>

      <div className="flex flex-col gap-[10px]">
        {(
          [
            { key: "refund" as const, label: "คืนเงินให้ผู้ซื้อ", sub: `${formatTHB(amount)} คืนเข้าบัญชีผู้ซื้อ` },
            { key: "release" as const, label: "โอนเงินให้ผู้ขาย", sub: `${formatTHB(amount)} โอนเข้าบัญชี ${sellerName}` },
          ]
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => { setOutcome(opt.key); setError(""); }}
            className="flex items-start gap-3 rounded-xl px-[14px] py-[13px] text-left"
            style={{ background: outcome === opt.key ? "rgba(95,212,255,0.05)" : "var(--panel-2)", border: `1.5px solid ${outcome === opt.key ? "var(--cyan)" : "rgba(140,147,163,0.18)"}` }}
          >
            <span className="mt-[1px] flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: 18, height: 18, border: `1.5px solid ${outcome === opt.key ? "var(--cyan)" : "rgba(140,147,163,0.4)"}` }}>
              {outcome === opt.key && <span className="rounded-full" style={{ width: 9, height: 9, background: "var(--cyan)" }} />}
            </span>
            <div>
              <p className="text-[13.5px] font-medium" style={{ color: "var(--white)" }}>
                {opt.label}
              </p>
              <p className="mt-[2px] text-[11.5px]" style={{ color: "var(--steel-dim)" }}>
                {opt.sub}
              </p>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <label className="mb-[7px] block text-[12.5px]" style={{ color: "var(--steel)" }}>
          บันทึกเหตุผล
        </label>
        <textarea
          maxLength={400}
          value={note}
          onChange={(e) => { setNote(e.target.value); setError(""); }}
          placeholder="เช่น เทียบรูปประกาศขายกับวิดีโอแกะกล่องแล้วพบว่า..."
          className="w-full resize-y rounded-[10px] p-[10px] text-[13.5px] leading-relaxed outline-none"
          style={{ background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--white)", minHeight: 74 }}
        />
      </div>

      {error && (
        <p className="mt-2 text-[12px]" style={{ color: "var(--danger)" }}>
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
        {submitting ? "..." : "ยืนยันผลการตัดสิน"}
      </button>
    </div>
  );
}
