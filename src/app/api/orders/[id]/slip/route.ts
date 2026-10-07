import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/session";
import { TERMS_REQUIRED, hasAcceptedTerms } from "@/lib/terms";
import { checkPhotoFile } from "@/lib/imageUpload";
import { parseSlipQr } from "@/lib/slipQr";

const BUCKET = "payment-slips";
// An admin checks slips by hand, so a slip under review keeps its order alive for this long.
const REVIEW_WINDOW_MS = 48 * 60 * 60 * 1000;

// The buyer's transfer slip for a PromptPay QR payment. Stored in a private bucket as evidence;
// it never marks anything paid: an admin confirms it against the bank statement (/admin/payments).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const userId = await getVerifiedUserId();
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน", code: "LOGIN_REQUIRED" }, { status: 403 });
  if (!(await hasAcceptedTerms(userId))) return NextResponse.json(TERMS_REQUIRED, { status: 403 });

  const supabase = createServiceClient();
  const { data: order } = await supabase.from("orders").select("buyer_id, status, payment_deadline_at").eq("id", orderId).maybeSingle();
  if (!order || order.buyer_id !== userId) return NextResponse.json({ error: "ไม่พบคำสั่งซื้อนี้" }, { status: 404 });
  // A slip for a cancelled order is accepted too: the buyer may have paid just after the deadline, and
  // the admin refunds it by hand. A paid order has nothing to confirm.
  if (order.status !== "PENDING_PAYMENT" && order.status !== "CANCELLED") {
    return NextResponse.json({ error: "คำสั่งซื้อนี้ชำระเงินไปแล้ว" }, { status: 409 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "ไฟล์ใหญ่เกินไป ลองเลือกรูปที่เล็กลง" }, { status: 413 });
  }
  const slip = formData.get("slip");
  if (!(slip instanceof File)) return NextResponse.json({ error: "เลือกรูปสลิปก่อน" }, { status: 400 });
  const check = await checkPhotoFile(slip, "สลิป");
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const path = `${orderId}/${crypto.randomUUID()}.${check.type.ext}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, check.bytes, { contentType: check.type.contentType });
  if (uploadError) {
    console.error("[slip] upload failed", uploadError.message);
    return NextResponse.json({ error: "อัปโหลดสลิปไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }

  // The slip's own QR, read in the buyer's browser: only a hint, so the server parses it again. It stops one
  // slip being used for two payments; it does not prove the slip is real.
  const qr = parseSlipQr(formData.get("qr"));
  const { error } = await supabase
    .from("payment_slips")
    .insert({ order_id: orderId, buyer_id: userId, image_path: path, slip_ref: qr?.ref ?? null, slip_bank: qr?.bank ?? null });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    if (error.code === "23505") {
      if (error.message.includes("slip_ref")) return NextResponse.json({ error: "สลิปนี้เคยถูกใช้ชำระเงินแล้ว กรุณาส่งสลิปของการโอนครั้งนี้" }, { status: 409 });
      // One slip waits for review per order (unique index).
      return NextResponse.json({ error: "ส่งสลิปแล้ว รอทีมงานตรวจสอบ" }, { status: 409 });
    }
    console.error("[slip] save failed", error.message);
    return NextResponse.json({ error: "บันทึกสลิปไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }

  // Keep the order from auto-cancelling while the slip waits for a person.
  if (order.status === "PENDING_PAYMENT") {
    const until = new Date(Date.now() + REVIEW_WINDOW_MS).toISOString();
    if (!order.payment_deadline_at || order.payment_deadline_at < until) {
      await supabase.from("orders").update({ payment_deadline_at: until }).eq("id", orderId).eq("status", "PENDING_PAYMENT");
    }
  }
  return NextResponse.json({ success: true });
}
