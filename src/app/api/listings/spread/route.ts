import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/session";
import { checkPhotoFile } from "@/lib/imageUpload";
import {
  MAX_SPREAD_PHOTOS,
  MAX_SPREAD_UPLOAD_BYTES,
  SPREAD_POST_LIFETIME_MS,
  cheapestPrice,
  parseSpreadItems,
} from "@/lib/spreadPost";

/** Creates a spread post: one listing row, its photos, and one item row per circled card. */
export async function POST(request: Request) {
  const userId = await getVerifiedUserId();
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน", code: "LOGIN_REQUIRED" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "ไฟล์รูปรวมกันใหญ่เกินไป ลองใช้รูปที่เล็กลงหรือลดจำนวนรูป" }, { status: 413 });
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim().slice(0, 400);
  if (title.length < 3 || title.length > 80) {
    return NextResponse.json({ error: "ตั้งชื่อโพสต์ 3 – 80 ตัวอักษร" }, { status: 400 });
  }

  const files: File[] = [];
  for (let i = 0; i < MAX_SPREAD_PHOTOS; i++) {
    const f = formData.get(`photo${i}`);
    if (f instanceof File) files.push(f);
  }
  if (files.length === 0) return NextResponse.json({ error: "อัปโหลดรูปการ์ดอย่างน้อย 1 รูป" }, { status: 400 });
  if (files.reduce((sum, f) => sum + f.size, 0) > MAX_SPREAD_UPLOAD_BYTES) {
    return NextResponse.json({ error: "รูปรวมกันใหญ่เกินไป ลองลดจำนวนรูปหรือใช้รูปที่เล็กลง" }, { status: 413 });
  }

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return NextResponse.json({ error: "ข้อมูลการ์ดไม่ถูกต้อง" }, { status: 400 });
  }
  const parsed = parseSpreadItems(rawItems, files.length);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Check every photo's size and real type before anything is created.
  const checks = await Promise.all(files.map((f, i) => checkPhotoFile(f, `ที่ ${i + 1}`)));
  for (const check of checks) {
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const supabase = createServiceClient();
  const lowest = cheapestPrice(parsed.items);
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .insert({
      seller_id: userId,
      name: title,
      set_name: "หลายรายการ",
      category: "rare",
      rarity: "หลายใบ",
      condition: "หลายสภาพ",
      description,
      // The headline price is "from ฿X". Buy-now equals it so the post is never treated as an auction.
      start_price: lowest,
      buy_now_price: lowest,
      current_price: lowest,
      ends_at: new Date(Date.now() + SPREAD_POST_LIFETIME_MS).toISOString(),
      post_kind: "spread",
    })
    .select()
    .single();
  if (listingError || !listing) {
    console.error("spread listing insert failed", listingError);
    return NextResponse.json({ error: "เผยแพร่โพสต์ไม่สำเร็จ ลองอีกครั้ง" }, { status: 500 });
  }

  const fail = async (message: string) => {
    // Items go with the listing (cascade): never leave a half-made post behind.
    await supabase.from("listings").delete().eq("id", listing.id);
    return NextResponse.json({ error: message }, { status: 500 });
  };

  const { error: itemsError } = await supabase.from("listing_items").insert(
    parsed.items.map((item, index) => ({
      listing_id: listing.id,
      position: index + 1,
      photo_index: item.photoIndex,
      aspect: item.aspect,
      x: item.x,
      y: item.y,
      r: item.r,
      name: item.name,
      rarity: item.rarity,
      condition: item.condition,
      price: item.price,
    }))
  );
  if (itemsError) {
    console.error("spread items insert failed", itemsError);
    return fail("เผยแพร่โพสต์ไม่สำเร็จ ลองอีกครั้ง");
  }

  const urls: string[] = [];
  for (const [i, check] of checks.entries()) {
    if (!check.ok) continue;
    const path = `${listing.id}/post-${i}-${crypto.randomUUID()}.${check.type.ext}`;
    const { error } = await supabase.storage.from("listing-photos").upload(path, check.bytes, { contentType: check.type.contentType });
    if (error) return fail("อัปโหลดรูปไม่สำเร็จ ลองอีกครั้ง");
    urls.push(supabase.storage.from("listing-photos").getPublicUrl(path).data.publicUrl);
  }

  await supabase
    .from("listings")
    .update({ photo_urls: urls, photo_front_url: urls[0], photo_back_url: urls[1] ?? urls[0] })
    .eq("id", listing.id);

  return NextResponse.json({ id: listing.id, name: listing.name, itemCount: parsed.items.length });
}
