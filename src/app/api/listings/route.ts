import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/session";
import type { ListingCategory } from "@/lib/supabase/types";

const DURATIONS_DAYS = [1, 3, 5, 7];

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

  const formData = await request.formData();
  const front = formData.get("front");
  const back = formData.get("back");
  const name = String(formData.get("name") ?? "").trim();
  const setName = String(formData.get("set") ?? "").trim();
  const category = String(formData.get("category") ?? "") as ListingCategory;
  const condition = String(formData.get("condition") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const startPrice = parseInt(String(formData.get("startPrice") ?? ""), 10);
  const buyNowPriceRaw = String(formData.get("buyNowPrice") ?? "").trim();
  const buyNowPrice = buyNowPriceRaw ? parseInt(buyNowPriceRaw, 10) : null;
  const durationDays = DURATIONS_DAYS.includes(Number(formData.get("duration"))) ? Number(formData.get("duration")) : 3;

  if (!(front instanceof File) || !(back instanceof File)) {
    return NextResponse.json({ error: "อัปโหลดรูปทั้งด้านหน้าและด้านหลังก่อนเผยแพร่ประกาศ" }, { status: 400 });
  }
  if (!name || !setName || !category || !condition || !startPrice) {
    return NextResponse.json({ error: "กรอกข้อมูลให้ครบก่อนเผยแพร่ประกาศ" }, { status: 400 });
  }

  // Rarity isn't a separate form field yet (create-listing brief doesn't ask
  // for it) — derive a simple placeholder from category until a real
  // rarity picker is designed.
  const rarity = category === "new" ? "NEW" : category === "deck" ? "DECK" : "RARE";

  const supabase = createServiceClient();
  const { data: listing, error: insertError } = await supabase
    .from("listings")
    .insert({
      seller_id: userId,
      name,
      set_name: setName,
      category,
      rarity,
      condition,
      description,
      start_price: startPrice,
      buy_now_price: buyNowPrice,
      current_price: startPrice,
      ends_at: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();
  if (insertError || !listing) {
    console.error("listing insert failed", insertError);
    return NextResponse.json({ error: "เผยแพร่ประกาศไม่สำเร็จ ลองอีกครั้ง" }, { status: 500 });
  }

  const uploadOne = async (file: File, slot: "front" | "back") => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${listing.id}/${slot}.${ext}`;
    const { error } = await supabase.storage.from("listing-photos").upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
    if (error) return null;
    return supabase.storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
  };

  const [frontUrl, backUrl] = await Promise.all([uploadOne(front, "front"), uploadOne(back, "back")]);

  await supabase.from("listings").update({ photo_front_url: frontUrl, photo_back_url: backUrl }).eq("id", listing.id);

  return NextResponse.json({ id: listing.id, name: listing.name, startPrice: listing.start_price, rarity });
}
