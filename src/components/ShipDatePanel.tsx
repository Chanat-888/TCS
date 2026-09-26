"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThaiDateTimePicker } from "@/components/ThaiDateTimePicker";
import { formatRelativeTime, formatThaiDateTime } from "@/lib/format";
import { MAX_REASON_LENGTH, MAX_SHIP_LEAD_DAYS } from "@/lib/shipDate";
import type { ShipProposal } from "@/lib/supabase/types";
import { proposeCancel, proposeShipDate, respondToProposal, withdrawProposal } from "@/app/orders/[id]/shipDate/actions";

type Role = "buyer" | "seller";
type Form = null | "date" | "cancel";

const fieldStyle = { background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--white)" } as const;
const ghostButton = "min-h-11 rounded-[10px] px-4 text-[13.5px]";

const STATUS_LABEL: Record<ShipProposal["status"], string> = {
  pending: "รอคำตอบ",
  accepted: "ตกลง",
  declined: "ปฏิเสธ",
  withdrawn: "ถอนข้อเสนอแล้ว",
};

/**
 * Ship-date agreement, shown to both buyer and seller. The seller proposes a date
 * with a reason and the buyer accepts or declines; either side can later ask to
 * postpone or to cancel, and the other side answers. Everything is also written
 * to the order chat by the server actions.
 */
export function ShipDatePanel({
  orderId,
  role,
  currentUserId,
  shipByAt,
  proposals,
  isMeetup,
  canChange,
}: {
  orderId: string;
  role: Role;
  currentUserId: string;
  shipByAt: string | null;
  proposals: ShipProposal[];
  isMeetup: boolean;
  /** Only while the order is paid and not yet shipped. */
  canChange: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(null);
  const [dateIso, setDateIso] = useState("");
  const [reason, setReason] = useState("");
  const [declineNote, setDeclineNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pending = proposals.find((p) => p.status === "pending") ?? null;
  const history = proposals.filter((p) => p.status !== "pending").slice(0, 4);
  const other = role === "buyer" ? "ผู้ขาย" : "ผู้ซื้อ";
  const title = isMeetup ? "วันนัดส่งมอบ" : "วันส่งของ";

  // Nothing to show once shipped, unless a date was agreed or there is history.
  if (!canChange && !shipByAt && proposals.length === 0) return null;

  async function run(action: () => Promise<{ error?: string } | { success: true }>, after?: () => void) {
    setBusy(true);
    setError("");
    const result = await action();
    setBusy(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    after?.();
    router.refresh();
  }

  function reset() {
    setForm(null);
    setDateIso("");
    setReason("");
    setError("");
  }

  const who = (p: ShipProposal) => (p.proposed_by === currentUserId ? "คุณ" : other);
  const describe = (p: ShipProposal) =>
    p.kind === "cancel" ? "ขอยกเลิกคำสั่งซื้อ" : `${shipByAt && p.status !== "accepted" ? "ขอเลื่อน" : "เสนอ"}${title} ${formatThaiDateTime(p.proposed_date ?? "", { year: true })}`;

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--panel)", border: "1px solid rgba(95,212,255,0.2)" }}>
      <h3 className="text-[15px] font-medium">กำหนด{title}</h3>
      <p className="mt-[6px] text-[13px] leading-relaxed" style={{ color: "var(--steel)" }}>
        {shipByAt ? (
          <>
            {title}ที่ตกลงกัน:{" "}
            <strong className="mono" style={{ color: "var(--white)", fontWeight: 500 }}>
              {formatThaiDateTime(shipByAt, { year: true })}
            </strong>
          </>
        ) : (
          <>
            ยังไม่ได้ตกลง{title} — ผู้ขายเสนอวันพร้อมเหตุผล แล้วผู้ซื้อกดยอมรับหรือปฏิเสธ
            หากมีเหตุจำเป็นต้องเลื่อนหรือยกเลิก ให้แจ้งอีกฝ่ายพร้อมเหตุผลที่นี่
          </>
        )}
      </p>

      {pending && (
        <div className="mt-4 rounded-xl p-[14px]" style={{ background: "rgba(95,212,255,0.06)", border: "1px solid rgba(95,212,255,0.22)" }}>
          <p className="text-[13.5px]" style={{ color: "var(--white)" }}>
            <strong style={{ fontWeight: 500 }}>{who(pending)}</strong> {describe(pending)}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--steel)" }}>
            เหตุผล: {pending.reason}
          </p>
          {pending.proposed_by === currentUserId ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-[12.5px]" style={{ color: "var(--steel)" }}>รอ{other}ตอบรับ</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => withdrawProposal(pending.id))}
                className={ghostButton}
                style={{ background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--steel)" }}
              >
                ถอนข้อเสนอ
              </button>
            </div>
          ) : (
            <div className="mt-3">
              <input
                value={declineNote}
                maxLength={MAX_REASON_LENGTH}
                onChange={(e) => setDeclineNote(e.target.value)}
                placeholder="ข้อความถึงอีกฝ่าย (ไม่บังคับ)"
                className="min-h-11 w-full rounded-[10px] px-3 text-[14px] outline-none"
                style={fieldStyle}
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busy || !canChange}
                  onClick={() => run(() => respondToProposal(pending.id, true, declineNote), () => setDeclineNote(""))}
                  className={`${ghostButton} font-semibold`}
                  style={{ background: "var(--blue)", color: "#071523" }}
                >
                  ยอมรับ
                </button>
                <button
                  type="button"
                  disabled={busy || !canChange}
                  onClick={() => run(() => respondToProposal(pending.id, false, declineNote), () => setDeclineNote(""))}
                  className={ghostButton}
                  style={{ background: "transparent", border: "1px solid var(--danger-line)", color: "var(--danger)" }}
                >
                  ปฏิเสธ
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {canChange && !pending && form === null && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setForm("date")}
            className={`${ghostButton} font-semibold`}
            style={{ background: "var(--blue)", color: "#071523" }}
          >
            {shipByAt ? `ขอเลื่อน${title}` : `เสนอ${title}`}
          </button>
          <button
            type="button"
            onClick={() => setForm("cancel")}
            className={ghostButton}
            style={{ background: "transparent", border: "1px solid var(--danger-line)", color: "var(--danger)" }}
          >
            ขอยกเลิกคำสั่งซื้อ
          </button>
        </div>
      )}

      {canChange && !pending && form !== null && (
        <div className="mt-4">
          {form === "date" && (
            <>
              <p className="mb-2 text-[12.5px]" style={{ color: "var(--steel)" }}>
                {shipByAt ? "วันใหม่ที่ขอเลื่อนไป" : "วันและเวลาที่ต้องการ"} (ภายใน {MAX_SHIP_LEAD_DAYS} วัน)
              </p>
              <ThaiDateTimePicker onChange={setDateIso} days={MAX_SHIP_LEAD_DAYS} />
            </>
          )}
          <label className="mb-[7px] mt-3 block text-[12.5px]" style={{ color: "var(--steel)" }}>
            เหตุผล (บังคับ)
          </label>
          <textarea
            value={reason}
            maxLength={MAX_REASON_LENGTH}
            onChange={(e) => { setReason(e.target.value); setError(""); }}
            placeholder={form === "cancel" ? "เช่น ผู้ขายหาของไม่เจอ / ผู้ซื้อเปลี่ยนใจเพราะ…" : "เช่น ต้องรอของเข้า / ติดธุระฉุกเฉินสัปดาห์นี้"}
            className="w-full resize-y rounded-[10px] p-[11px] text-[14px] leading-relaxed outline-none"
            style={{ ...fieldStyle, minHeight: 72 }}
          />
          {form === "cancel" && (
            <p className="mt-2 text-[12px]" style={{ color: "var(--steel)" }}>
              หาก{other}ยอมรับ คำสั่งซื้อจะถูกยกเลิกและเงินคืนผู้ซื้อ
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  () => (form === "cancel" ? proposeCancel(orderId, reason) : proposeShipDate(orderId, dateIso, reason)),
                  reset
                )
              }
              className={`${ghostButton} font-semibold disabled:opacity-60`}
              style={form === "cancel" ? { background: "var(--danger)", color: "#fff" } : { background: "var(--blue)", color: "#071523" }}
            >
              {busy ? "กำลังส่ง…" : form === "cancel" ? "ส่งคำขอยกเลิก" : "ส่งข้อเสนอ"}
            </button>
            <button type="button" disabled={busy} onClick={reset} className={ghostButton} style={{ background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--steel)" }}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {history.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2" style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>
          {history.map((p) => (
            <li key={p.id} className="text-[12.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
              <span style={{ color: "var(--white)" }}>{who(p)}</span> {describe(p)} —{" "}
              <span style={{ color: p.status === "accepted" ? "var(--good)" : p.status === "declined" ? "var(--danger)" : "var(--steel)" }}>
                {STATUS_LABEL[p.status]}
              </span>{" "}
              <span className="mono">· {formatRelativeTime(p.responded_at ?? p.created_at)}</span>
              {p.response_note ? <> · “{p.response_note}”</> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
