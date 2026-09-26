"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireVerifiedUserId } from "@/lib/session";
import { formatThaiDateTime } from "@/lib/format";
import { checkCancelProposal, checkShipDateProposal } from "@/lib/shipDate";
import type { Order, ShipProposal } from "@/lib/supabase/types";

type Supabase = ReturnType<typeof createServiceClient>;
type Role = "buyer" | "seller";

const NOT_FOUND = "ไม่พบคำสั่งซื้อนี้";
const CHANGED = "สถานะคำสั่งซื้อเปลี่ยนไปแล้ว กรุณารีเฟรชหน้า";

function roleOf(order: Pick<Order, "buyer_id" | "seller_id">, userId: string): Role | null {
  if (order.buyer_id === userId) return "buyer";
  if (order.seller_id === userId) return "seller";
  return null;
}

function refresh(orderId: string) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}/seller`);
}

// Each step is also written to the order chat, so both sides (and an admin in a
// dispute) can read the whole negotiation. Never lets a chat failure undo the step.
async function note(supabase: Supabase, orderId: string, senderId: string, body: string) {
  try {
    await supabase.from("messages").insert({ order_id: orderId, sender_id: senderId, body: `[ระบบ] ${body}` });
  } catch {
    // best effort
  }
}

async function loadOrderForParty(supabase: Supabase, orderId: string, userId: string) {
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || !roleOf(order, userId)) return { error: NOT_FOUND };
  // Agreements only matter before the card leaves the seller's hands.
  if (order.status !== "PAID_HELD") return { error: "เปลี่ยนแปลงวันส่งได้เฉพาะก่อนผู้ขายจัดส่งสินค้า" };
  return { order: order as Order, role: roleOf(order, userId) as Role };
}

async function insertProposal(
  supabase: Supabase,
  row: { order_id: string; proposed_by: string; kind: "ship_date" | "cancel"; proposed_date: string | null; reason: string }
) {
  const { error } = await supabase.from("order_ship_proposals").insert(row);
  if (error) {
    if ((error as { code?: string }).code === "23505") return { error: "มีข้อเสนอที่รอคำตอบอยู่แล้ว กรุณารอหรือถอนข้อเสนอเดิมก่อน" };
    return { error: "ส่งข้อเสนอไม่สำเร็จ ลองอีกครั้ง" };
  }
  return null;
}

export async function proposeShipDate(orderId: string, dateIso: string, reason: string) {
  const userId = await requireVerifiedUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };

  const supabase = createServiceClient();
  const loaded = await loadOrderForParty(supabase, orderId, userId);
  if ("error" in loaded) return { error: loaded.error };

  const checked = checkShipDateProposal(dateIso, reason);
  if (!checked.ok) return { error: checked.error };

  const failed = await insertProposal(supabase, {
    order_id: orderId, proposed_by: userId, kind: "ship_date", proposed_date: checked.proposedDate, reason: checked.reason,
  });
  if (failed) return failed;

  const verb = loaded.order.ship_by_at ? "ขอเลื่อนวันส่งเป็น" : "เสนอวันส่งของ";
  await note(supabase, orderId, userId, `${verb} ${formatThaiDateTime(checked.proposedDate as string, { year: true })} — เหตุผล: ${checked.reason}`);
  refresh(orderId);
  return { success: true as const };
}

export async function proposeCancel(orderId: string, reason: string) {
  const userId = await requireVerifiedUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };

  const supabase = createServiceClient();
  const loaded = await loadOrderForParty(supabase, orderId, userId);
  if ("error" in loaded) return { error: loaded.error };

  const checked = checkCancelProposal(reason);
  if (!checked.ok) return { error: checked.error };

  const failed = await insertProposal(supabase, {
    order_id: orderId, proposed_by: userId, kind: "cancel", proposed_date: null, reason: checked.reason,
  });
  if (failed) return failed;

  await note(supabase, orderId, userId, `ขอยกเลิกคำสั่งซื้อ — เหตุผล: ${checked.reason}`);
  refresh(orderId);
  return { success: true as const };
}

/** The other party answers a pending proposal. Accepting applies it to the order. */
export async function respondToProposal(proposalId: string, accept: boolean, responseNote = "") {
  const userId = await requireVerifiedUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };

  const supabase = createServiceClient();
  const { data: proposal } = await supabase.from("order_ship_proposals").select("*").eq("id", proposalId).maybeSingle();
  if (!proposal) return { error: "ไม่พบข้อเสนอนี้" as const };
  const p = proposal as ShipProposal;
  if (p.status !== "pending") return { error: "ข้อเสนอนี้ได้รับคำตอบไปแล้ว" as const };
  if (p.proposed_by === userId) return { error: "คุณตอบข้อเสนอของตัวเองไม่ได้ — รออีกฝ่ายตอบ หรือถอนข้อเสนอ" as const };

  const loaded = await loadOrderForParty(supabase, p.order_id, userId);
  if ("error" in loaded) return { error: loaded.error };

  const cleanNote = String(responseNote ?? "").trim().slice(0, 300);
  const now = new Date().toISOString();

  // Claim the answer first so two clicks (or a withdraw at the same moment) can't both apply.
  const { data: claimed, error: claimError } = await supabase
    .from("order_ship_proposals")
    .update({ status: accept ? "accepted" : "declined", response_note: cleanNote || null, responded_at: now })
    .eq("id", proposalId)
    .eq("status", "pending")
    .select("id");
  if (claimError) return { error: "ดำเนินการไม่สำเร็จ ลองอีกครั้ง" as const };
  if (!claimed || claimed.length === 0) return { error: "ข้อเสนอนี้ได้รับคำตอบไปแล้ว" as const };

  if (accept) {
    const changes =
      p.kind === "cancel"
        ? { status: "CANCELLED", cancelled_at: now }
        : { ship_by_at: p.proposed_date };
    const { data: moved, error: moveError } = await supabase
      .from("orders")
      .update(changes)
      .eq("id", p.order_id)
      .eq("status", "PAID_HELD")
      .select("id");
    if (moveError || !moved || moved.length === 0) {
      await supabase
        .from("order_ship_proposals")
        .update({ status: "pending", response_note: null, responded_at: null })
        .eq("id", proposalId)
        .eq("status", "accepted");
      return { error: moveError ? ("ดำเนินการไม่สำเร็จ ลองอีกครั้ง" as const) : (CHANGED as string) };
    }
  }

  const what = p.kind === "cancel" ? "ยกเลิกคำสั่งซื้อ" : `วันส่ง ${formatThaiDateTime(p.proposed_date as string, { year: true })}`;
  const verdict = accept ? (p.kind === "cancel" ? "ยอมรับ — ยกเลิกคำสั่งซื้อแล้ว (เงินจะคืนผู้ซื้อ)" : "ยอมรับ") : "ปฏิเสธ";
  await note(supabase, p.order_id, userId, `${verdict}ข้อเสนอ${what}${cleanNote ? ` — ${cleanNote}` : ""}`);
  refresh(p.order_id);
  return { success: true as const, cancelled: accept && p.kind === "cancel" };
}

/** The proposer takes back their own open proposal. */
export async function withdrawProposal(proposalId: string) {
  const userId = await requireVerifiedUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };

  const supabase = createServiceClient();
  const { data: proposal } = await supabase.from("order_ship_proposals").select("*").eq("id", proposalId).maybeSingle();
  if (!proposal || (proposal as ShipProposal).proposed_by !== userId) return { error: "ไม่พบข้อเสนอนี้" as const };

  const { data: claimed, error } = await supabase
    .from("order_ship_proposals")
    .update({ status: "withdrawn", responded_at: new Date().toISOString() })
    .eq("id", proposalId)
    .eq("status", "pending")
    .select("id");
  if (error) return { error: "ดำเนินการไม่สำเร็จ ลองอีกครั้ง" as const };
  if (!claimed || claimed.length === 0) return { error: "ข้อเสนอนี้ได้รับคำตอบไปแล้ว" as const };

  refresh((proposal as ShipProposal).order_id);
  return { success: true as const };
}
