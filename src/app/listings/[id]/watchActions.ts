"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireVerifiedUserId } from "@/lib/session";

/** Stars or unstars a listing for the signed-in buyer, who then gets notified when it's ending soon or has closed. */
export async function toggleWatch(listingId: string) {
  const userId = await requireVerifiedUserId();
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("watchlist")
    .select("id")
    .eq("user_id", userId)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("watchlist").delete().eq("id", existing.id);
    if (error) return { error: "เลิกติดตามไม่สำเร็จ ลองอีกครั้ง" as const };
    revalidatePath(`/listings/${listingId}`);
    return { watching: false as const };
  }

  const { error } = await supabase.from("watchlist").insert({ user_id: userId, listing_id: listingId });
  if (error) return { error: "ติดตามไม่สำเร็จ ลองอีกครั้ง" as const };
  revalidatePath(`/listings/${listingId}`);
  return { watching: true as const };
}
