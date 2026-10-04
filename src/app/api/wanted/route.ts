import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/session";
import { parseWantedFields } from "@/lib/wantedForm";
import { checkPhotoFile } from "@/lib/imageUpload";
import { pickedPhoto, storeWantedPhoto } from "@/lib/wantedPhoto";

export async function POST(request: Request) {
  const userId = await getVerifiedUserId();
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน", code: "LOGIN_REQUIRED" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "ไฟล์รูปใหญ่เกินไป ลองเลือกรูปที่เล็กลง" }, { status: 413 });
  }

  const parsed = parseWantedFields((key) => formData.get(key));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Check the photo before creating anything, so a bad photo never leaves a half-made post.
  const photoFile = pickedPhoto(formData.get("photo"));
  const photo = photoFile ? await checkPhotoFile(photoFile, "การ์ดที่ต้องการหา") : null;
  if (photo && !photo.ok) return NextResponse.json({ error: photo.error }, { status: 400 });

  const supabase = createServiceClient();
  const { data: post, error } = await supabase
    .from("wanted_posts")
    .insert({ poster_id: userId, ...parsed.fields })
    .select("id")
    .single();
  if (error || !post) {
    console.error("wanted post insert failed", error);
    return NextResponse.json({ error: "เผยแพร่ประกาศไม่สำเร็จ ลองอีกครั้ง" }, { status: 500 });
  }

  if (photo?.ok) {
    const stored = await storeWantedPhoto(supabase, post.id, photo);
    const { error: linkError } = stored.ok ? await supabase.from("wanted_posts").update({ photo_url: stored.url }).eq("id", post.id) : { error: null };
    if (!stored.ok || linkError) {
      // A post that was meant to have a picture must not go live without it.
      await supabase.from("wanted_posts").delete().eq("id", post.id);
      return NextResponse.json({ error: stored.ok ? "บันทึกรูปไม่สำเร็จ ลองอีกครั้ง" : stored.error }, { status: stored.ok ? 500 : stored.status });
    }
  }

  revalidatePath("/profile");
  revalidatePath("/browse");
  revalidatePath("/search");
  return NextResponse.json({ id: post.id });
}
