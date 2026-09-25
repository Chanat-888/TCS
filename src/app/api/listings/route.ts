import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/session";
import type { ListingCategory } from "@/lib/supabase/types";

// Hours: from a quick "hot time" auction up to a week.
const DURATIONS_HOURS = [1, 3, 6, 12, 24, 72, 120, 168];
const MIN_AUCTION_MS = 60 * 60 * 1000;
const MAX_AUCTION_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_BID_INCREMENT = 5;
const MAX_BID_INCREMENT = 1000;

export async function POST(request: Request) {
  const userId = await getVerifiedUserId();
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน", code: "LOGIN_REQUIRED" }, { status: 403 });

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
  const durationHours = DURATIONS_HOURS.includes(Number(formData.get("durationHours"))) ? Number(formData.get("durationHours")) : 72;
  // Seller may pick an exact end date/time instead of a preset length.
  const endsAtRaw = String(formData.get("endsAt") ?? "").trim();
  const customEndsAt = endsAtRaw ? new Date(endsAtRaw).getTime() : null;
  if (customEndsAt != null) {
    const untilEnd = customEndsAt - Date.now();
    // A minute of slack so "exactly 1 hour from now" picked a moment ago still passes.
    if (!Number.isFinite(untilEnd) || untilEnd < MIN_AUCTION_MS - 60_000 || untilEnd > MAX_AUCTION_MS) {
      return NextResponse.json({ error: "เวลาปิดประมูลต้องอยู่ระหว่าง 1 ชั่วโมง ถึง 30 วันจากตอนนี้" }, { status: 400 });
    }
  }
  const bidIncrementRaw = String(formData.get("bidIncrement") ?? "").trim();
  const bidIncrement = bidIncrementRaw ? parseInt(bidIncrementRaw, 10) : 100;

  if (!(front instanceof File) || !(back instanceof File)) {
    return NextResponse.json({ error: "อัปโหลดรูปทั้งด้านหน้าและด้านหลังก่อนเผยแพร่ประกาศ" }, { status: 400 });
  }
  if (!name || !setName || !category || !condition || !startPrice) {
    return NextResponse.json({ error: "กรอกข้อมูลให้ครบก่อนเผยแพร่ประกาศ" }, { status: 400 });
  }

  if (!Number.isInteger(bidIncrement) || bidIncrement < MIN_BID_INCREMENT || bidIncrement > MAX_BID_INCREMENT) {
    return NextResponse.json({ error: `บิดขั้นต่ำต้องอยู่ระหว่าง ฿${MIN_BID_INCREMENT} – ฿${MAX_BID_INCREMENT.toLocaleString("en-US")}` }, { status: 400 });
  }
  if (buyNowPrice != null && (!Number.isFinite(buyNowPrice) || buyNowPrice < startPrice)) {
    return NextResponse.json({ error: "ราคาชนะทันทีต้องไม่ต่ำกว่าราคาเริ่มต้น" }, { status: 400 });
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
      // Only sent when non-default so listing still works before migration 0015 is applied.
      ...(bidIncrement !== 100 ? { bid_increment: bidIncrement } : {}),
      ends_at: new Date(customEndsAt ?? Date.now() + durationHours * 60 * 60 * 1000).toISOString(),
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
