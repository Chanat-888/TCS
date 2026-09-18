import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/session";

const AUTO_APPROVE_HOURS = 48;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || order.buyer_id !== userId) return NextResponse.json({ error: "ไม่พบคำสั่งซื้อนี้" }, { status: 404 });
  if (order.status !== "SHIPPED" && order.status !== "DELIVERED") {
    return NextResponse.json({ error: "ยังไม่ถึงขั้นตอนอัปโหลดวิดีโอ" }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("video");
  if (!(file instanceof File)) return NextResponse.json({ error: "ไม่พบไฟล์วิดีโอ" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "mp4";
  const path = `${orderId}/unboxing.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("unboxing-videos")
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
  if (uploadError) return NextResponse.json({ error: "อัปโหลดไม่สำเร็จ ลองอีกครั้ง" }, { status: 500 });

  const { data: publicUrl } = supabase.storage.from("unboxing-videos").getPublicUrl(path);
  const autoApproveAt = new Date(Date.now() + AUTO_APPROVE_HOURS * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  // No real courier-tracking integration exists yet (PRODUCT.md — shipping
  // API is undecided), so recording the unboxing video is treated as the
  // delivery confirmation: a buyer can't unbox what hasn't arrived.
  const { error: updateError } = await supabase
    .from("orders")
    .update({
      unboxing_video_url: publicUrl.publicUrl,
      video_uploaded_at: now,
      auto_approve_at: autoApproveAt,
      status: "DELIVERED",
      delivered_at: order.delivered_at ?? now,
    })
    .eq("id", orderId);
  if (updateError) return NextResponse.json({ error: "อัปโหลดไม่สำเร็จ ลองอีกครั้ง" }, { status: 500 });

  return NextResponse.json({ url: publicUrl.publicUrl, filename: file.name, autoApproveAt, deliveredAt: order.delivered_at ?? now });
}
