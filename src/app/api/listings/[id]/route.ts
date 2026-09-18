import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/session";
import type { ListingCategory } from "@/lib/supabase/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: listing } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
  if (!listing || listing.seller_id !== userId) return NextResponse.json({ error: "ไม่พบประกาศนี้" }, { status: 404 });

  const { count: bidCount } = await supabase.from("bids").select("id", { count: "exact", head: true }).eq("listing_id", id);
  const locked = (bidCount ?? 0) > 0;

  const formData = await request.formData();
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

  const update: Record<string, unknown> = {
    name,
    set_name: setName,
    category,
    condition,
    description,
    start_price: startPrice,
    buy_now_price: buyNowPrice,
    current_price: startPrice,
  };

  const front = formData.get("front");
  const back = formData.get("back");
  if (front instanceof File) {
    const ext = front.name.split(".").pop() ?? "jpg";
    const path = `${id}/front.${ext}`;
    await supabase.storage.from("listing-photos").upload(path, await front.arrayBuffer(), { contentType: front.type, upsert: true });
    update.photo_front_url = supabase.storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
  }
  if (back instanceof File) {
    const ext = back.name.split(".").pop() ?? "jpg";
    const path = `${id}/back.${ext}`;
    await supabase.storage.from("listing-photos").upload(path, await back.arrayBuffer(), { contentType: back.type, upsert: true });
    update.photo_back_url = supabase.storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabase.from("listings").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "บันทึกไม่สำเร็จ ลองอีกครั้ง" }, { status: 500 });

  return NextResponse.json({ success: true });
}
