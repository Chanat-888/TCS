import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/session";
import { parseWantedFields } from "@/lib/wantedForm";
import { checkPhotoFile } from "@/lib/imageUpload";
import { pickedPhoto, storeWantedPhoto } from "@/lib/wantedPhoto";

/** Poster edits their own open post; a new photo replaces the old one, no photo keeps it. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getVerifiedUserId();
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน", code: "LOGIN_REQUIRED" }, { status: 403 });

  const supabase = createServiceClient();
  const { data: post } = await supabase.from("wanted_posts").select("poster_id, status").eq("id", id).maybeSingle();
  if (!post || post.poster_id !== userId) return NextResponse.json({ error: "ไม่พบประกาศนี้" }, { status: 404 });
  if (post.status !== "active") return NextResponse.json({ error: "ประกาศนี้ปิดแล้ว แก้ไขไม่ได้" }, { status: 409 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "ไฟล์รูปใหญ่เกินไป ลองเลือกรูปที่เล็กลง" }, { status: 413 });
  }

  const parsed = parseWantedFields((key) => formData.get(key));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const update: Record<string, unknown> = { ...parsed.fields };
  const photoFile = pickedPhoto(formData.get("photo"));
  if (photoFile) {
    const checked = await checkPhotoFile(photoFile, "การ์ดที่ต้องการหา");
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
    const stored = await storeWantedPhoto(supabase, id, checked);
    if (!stored.ok) return NextResponse.json({ error: stored.error }, { status: stored.status });
    update.photo_url = stored.url;
  }

  // Limited to the poster's own row that is still open, so a post closed meanwhile stays as it was.
  const { data: updated, error } = await supabase
    .from("wanted_posts")
    .update(update)
    .eq("id", id)
    .eq("poster_id", userId)
    .eq("status", "active")
    .select("id");
  if (error) return NextResponse.json({ error: "บันทึกไม่สำเร็จ ลองอีกครั้ง" }, { status: 500 });
  if (!updated?.length) return NextResponse.json({ error: "ประกาศนี้ปิดแล้ว แก้ไขไม่ได้" }, { status: 409 });

  revalidatePath("/profile");
  revalidatePath("/browse");
  revalidatePath("/search");
  return NextResponse.json({ success: true });
}
