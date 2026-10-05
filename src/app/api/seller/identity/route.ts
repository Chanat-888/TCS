import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/session";
import { checkPhotoFile } from "@/lib/imageUpload";

const BUCKET = "id-checks";

// A seller sends a selfie holding the ID card plus the card front. Stored in a private bucket
// under the seller's own folder; an admin looks at them once and the files are deleted on
// the decision (src/app/admin/sellers/actions.ts).
export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน", code: "LOGIN_REQUIRED" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "ไฟล์รูปรวมกันใหญ่เกินไป ลองเลือกรูปที่เล็กลง" }, { status: 413 });
  }
  if (formData.get("consent") !== "on") {
    return NextResponse.json({ error: "ติ๊กยินยอมให้ TCS ใช้รูปเพื่อตรวจสอบตัวตนก่อน" }, { status: 400 });
  }
  const selfie = formData.get("selfie");
  const card = formData.get("card");
  if (!(selfie instanceof File) || !(card instanceof File)) {
    return NextResponse.json({ error: "เลือกรูปเซลฟี่คู่บัตรและรูปหน้าบัตรให้ครบ" }, { status: 400 });
  }
  const [selfieCheck, cardCheck] = await Promise.all([checkPhotoFile(selfie, "เซลฟี่คู่บัตร"), checkPhotoFile(card, "หน้าบัตร")]);
  if (!selfieCheck.ok) return NextResponse.json({ error: selfieCheck.error }, { status: 400 });
  if (!cardCheck.ok) return NextResponse.json({ error: cardCheck.error }, { status: 400 });

  const supabase = createServiceClient();
  const { data: existing } = await supabase.from("seller_verifications").select("status, selfie_path, card_path").eq("user_id", userId).maybeSingle();
  if (existing?.status === "approved") return NextResponse.json({ error: "คุณยืนยันตัวตนแล้ว" }, { status: 409 });

  const selfiePath = `${userId}/${crypto.randomUUID()}.${selfieCheck.type.ext}`;
  const cardPath = `${userId}/${crypto.randomUUID()}.${cardCheck.type.ext}`;
  const uploads = await Promise.all([
    supabase.storage.from(BUCKET).upload(selfiePath, selfieCheck.bytes, { contentType: selfieCheck.type.contentType }),
    supabase.storage.from(BUCKET).upload(cardPath, cardCheck.bytes, { contentType: cardCheck.type.contentType }),
  ]);
  const failed = uploads.find((u) => u.error);
  if (failed?.error) {
    console.error("[identity] upload failed", failed.error.message);
    await supabase.storage.from(BUCKET).remove([selfiePath, cardPath]);
    return NextResponse.json({ error: "อัปโหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }

  const { error } = await supabase.from("seller_verifications").upsert({
    user_id: userId,
    status: "submitted",
    legal_name: null,
    selfie_path: selfiePath,
    card_path: cardPath,
    reject_reason: null,
    submitted_at: new Date().toISOString(),
    decided_at: null,
    decided_by: null,
  });
  if (error) {
    console.error("[identity] save failed", error.message);
    await supabase.storage.from(BUCKET).remove([selfiePath, cardPath]);
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }

  // A resubmission replaces the earlier images; best effort, never affects the result.
  const old = [existing?.selfie_path, existing?.card_path].filter((p): p is string => Boolean(p));
  if (old.length) await supabase.storage.from(BUCKET).remove(old);
  return NextResponse.json({ success: true });
}
