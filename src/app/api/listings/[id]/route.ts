import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/session";
import type { ListingCategory } from "@/lib/supabase/types";
import { parseListingDetails } from "@/lib/vanguard";
import { checkPhotoFile } from "@/lib/imageUpload";
import { MIN_PRICE, isSpread } from "@/lib/listingKind";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getVerifiedUserId();
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน", code: "LOGIN_REQUIRED" }, { status: 403 });

  const supabase = createServiceClient();
  const { data: listing } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
  if (!listing || listing.seller_id !== userId) return NextResponse.json({ error: "ไม่พบประกาศนี้" }, { status: 404 });
  // A sold, cancelled or expired listing is a record of what the buyer bought (and the evidence in
  // any dispute): it must not change. "Buy now" creates no bid, so the bid lock alone is not enough.
  if (listing.status !== "active") {
    return NextResponse.json({ error: "ประกาศนี้ปิดการขายแล้ว แก้ไขไม่ได้" }, { status: 409 });
  }
  if (isSpread(listing)) {
    return NextResponse.json({ error: "โพสต์เลือกซื้อเป็นใบ ๆ แก้ไขไม่ได้ กรุณาปิดโพสต์แล้วลงใหม่" }, { status: 409 });
  }

  const { count: bidCount } = await supabase.from("bids").select("id", { count: "exact", head: true }).eq("listing_id", id);
  const locked = (bidCount ?? 0) > 0;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "ไฟล์รูปรวมกันใหญ่เกินไป ลองเลือกรูปที่เล็กลง" }, { status: 413 });
  }
  const description = String(formData.get("description") ?? "").trim();

  if (locked) {
    // Post-bid: only the description can change, and a genuine change is
    // flagged with a visible "แก้ไขแล้ว" indicator (PRODUCT.md edit-lock policy).
    const changed = description !== (listing.description ?? "");
    const { error } = await supabase
      .from("listings")
      .update({ description, description_edited_at: changed ? new Date().toISOString() : listing.description_edited_at })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "บันทึกไม่สำเร็จ ลองอีกครั้ง" }, { status: 500 });
    return NextResponse.json({ success: true, changed, editedAt: changed ? new Date().toISOString() : listing.description_edited_at });
  }

  // Pre-bid: full edit, matching create-listing's fields.
  const name = String(formData.get("name") ?? "").trim();
  const setName = String(formData.get("set") ?? "").trim();
  const category = String(formData.get("category") ?? "") as ListingCategory;
  const condition = String(formData.get("condition") ?? "").trim();
  const startPrice = parseInt(String(formData.get("startPrice") ?? ""), 10);
  const buyNowPriceRaw = String(formData.get("buyNowPrice") ?? "").trim();
  const buyNowPrice = buyNowPriceRaw ? parseInt(buyNowPriceRaw, 10) : null;

  if (!name || !setName || !category || !condition || !startPrice) {
    return NextResponse.json({ error: "กรอกข้อมูลให้ครบก่อนบันทึก" }, { status: 400 });
  }
  if (!Number.isInteger(startPrice) || startPrice < MIN_PRICE) {
    return NextResponse.json({ error: `ราคาต้องไม่ต่ำกว่า ฿${MIN_PRICE}` }, { status: 400 });
  }

  const details = parseListingDetails(category, {
    rarity: String(formData.get("rarity") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    hasExtras: String(formData.get("hasExtras") ?? ""),
  });
  if (!details.ok) return NextResponse.json({ error: details.error }, { status: 400 });

  const update: Record<string, unknown> = {
    rarity: details.rarity,
    name,
    set_name: setName,
    category,
    condition,
    description,
    start_price: startPrice,
    buy_now_price: buyNowPrice,
    current_price: startPrice,
  };

  // Before migration 0017 these columns don't exist: only write them when they
  // carry information or the row already has them.
  if (details.quantity !== 1 || "quantity" in listing) update.quantity = details.quantity;
  if (details.hasExtras !== null || "has_extras" in listing) update.has_extras = details.hasExtras;

  const front = formData.get("front");
  const back = formData.get("back");
  for (const [file, slot, label] of [[front, "front", "ด้านหน้า"], [back, "back", "ด้านหลัง"]] as const) {
    if (!(file instanceof File)) continue;
    const checked = await checkPhotoFile(file, label);
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
    const path = `${id}/${slot}-${crypto.randomUUID()}.${checked.type.ext}`;
    const { error: uploadError } = await supabase.storage
      .from("listing-photos")
      .upload(path, checked.bytes, { contentType: checked.type.contentType });
    if (uploadError) return NextResponse.json({ error: "อัปโหลดรูปไม่สำเร็จ ลองอีกครั้ง" }, { status: 500 });
    update[slot === "front" ? "photo_front_url" : "photo_back_url"] = supabase.storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabase.from("listings").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "บันทึกไม่สำเร็จ ลองอีกครั้ง" }, { status: 500 });

  return NextResponse.json({ success: true });
}
