/** Rules for the ship-date agreement between buyer and seller. */
export const MIN_SHIP_LEAD_MS = 60 * 60 * 1000;
export const MAX_SHIP_LEAD_DAYS = 14;
export const MAX_SHIP_LEAD_MS = MAX_SHIP_LEAD_DAYS * 24 * 60 * 60 * 1000;
export const MIN_REASON_LENGTH = 5;
export const MAX_REASON_LENGTH = 300;

export type ProposalCheck =
  | { ok: true; proposedDate: string | null; reason: string }
  | { ok: false; error: string };

function cleanReason(reason: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const value = typeof reason === "string" ? reason.trim().slice(0, MAX_REASON_LENGTH) : "";
  if (value.length < MIN_REASON_LENGTH) return { ok: false, error: `ระบุเหตุผลอย่างน้อย ${MIN_REASON_LENGTH} ตัวอักษร` };
  return { ok: true, value };
}

/** A proposed ship date must be 1 hour to 14 days from now, with a reason. */
export function checkShipDateProposal(dateIso: unknown, reason: unknown, now: number = Date.now()): ProposalCheck {
  const r = cleanReason(reason);
  if (!r.ok) return r;
  const time = typeof dateIso === "string" ? new Date(dateIso).getTime() : NaN;
  if (!Number.isFinite(time)) return { ok: false, error: "เลือกวันและเวลาที่จะส่งของ" };
  const lead = time - now;
  if (lead < MIN_SHIP_LEAD_MS - 60_000 || lead > MAX_SHIP_LEAD_MS) {
    return { ok: false, error: `วันส่งของต้องอยู่ระหว่าง 1 ชั่วโมง ถึง ${MAX_SHIP_LEAD_DAYS} วันจากตอนนี้` };
  }
  return { ok: true, proposedDate: new Date(time).toISOString(), reason: r.value };
}

export function checkCancelProposal(reason: unknown): ProposalCheck {
  const r = cleanReason(reason);
  if (!r.ok) return r;
  return { ok: true, proposedDate: null, reason: r.value };
}
