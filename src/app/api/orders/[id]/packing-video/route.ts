import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/session";
import { checkVideoFile } from "@/lib/videoUpload";

/**
 * The seller's packing video. TCS always requires video evidence from both
 * sides: the seller records packing the card before shipping (or before a
 * meet-up hand-over), and the buyer records the unboxing.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const userId = await getVerifiedUserId();
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน", code: "LOGIN_REQUIRED" }, { status: 403 });

  const supabase = createServiceClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || order.seller_id !== userId) return NextResponse.json({ error: "ไม่พบคำสั่งขายนี้" }, { status: 404 });
  // Only before shipping: once shipped the video is evidence and can't be swapped.
  if (order.status !== "PAID_HELD") return NextResponse.json({ error: "อัปโหลดวิดีโอแพ็คของได้ก่อนยืนยันการจัดส่งเท่านั้น" }, { status: 400 });

  const formData = await request.formData();
  const file = formData.get("video");
  if (!(file instanceof File)) return NextResponse.json({ error: "ไม่พบไฟล์วิดีโอ" }, { status: 400 });

  const checked = await checkVideoFile(file);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

  const path = `${orderId}/packing-${crypto.randomUUID()}.${checked.type.ext}`;
  const { error: uploadError } = await supabase.storage
    .from("unboxing-videos")
    .upload(path, checked.bytes, { contentType: checked.type.contentType });
  if (uploadError) return NextResponse.json({ error: "อัปโหลดไม่สำเร็จ ลองอีกครั้ง" }, { status: 500 });

  const { data: publicUrl } = supabase.storage.from("unboxing-videos").getPublicUrl(path);
  const { data: claimed, error: updateError } = await supabase
    .from("orders")
    .update({ packing_video_url: publicUrl.publicUrl, packing_video_uploaded_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "PAID_HELD")
    .select("id");
  if (updateError) return NextResponse.json({ error: "อัปโหลดไม่สำเร็จ ลองอีกครั้ง" }, { status: 500 });
  if (!claimed || claimed.length === 0) {
    await supabase.storage.from("unboxing-videos").remove([path]);
    return NextResponse.json({ error: "อัปโหลดวิดีโอแพ็คของได้ก่อนยืนยันการจัดส่งเท่านั้น" }, { status: 409 });
  }

  return NextResponse.json({ url: publicUrl.publicUrl, filename: file.name });
}
