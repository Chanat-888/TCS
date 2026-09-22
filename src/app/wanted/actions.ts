"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireVerifiedUserId } from "@/lib/session";
import type { ListingCategory } from "@/lib/supabase/types";

export async function createWantedPost(formData: FormData) {
  const userId = await requireVerifiedUserId();

  const name = String(formData.get("name") ?? "").trim();
  const setName = String(formData.get("set") ?? "").trim();
  const category = String(formData.get("category") ?? "") as ListingCategory;
  const maxPrice = parseInt(String(formData.get("maxPrice") ?? ""), 10);
  const note = String(formData.get("note") ?? "").trim();

  if (!name || !setName || !category || !maxPrice) redirect("/wanted/new?error=1");

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("wanted_posts")
    .insert({ poster_id: userId, name, set_name: setName, category, max_price: maxPrice, note });
  if (error) redirect("/wanted/new?error=1");

  revalidatePath("/profile");
  revalidatePath("/browse");
  redirect("/profile");
}

export async function sendWantedPostMessage(wantedPostId: string, responderId: string, body: string) {
  const userId = await requireVerifiedUserId();
  if (!body.trim()) return { error: "ส่งข้อความไม่สำเร็จ" as const };

  const supabase = createServiceClient();
  const { data: post } = await supabase.from("wanted_posts").select("poster_id").eq("id", wantedPostId).maybeSingle();
  if (!post || post.poster_id === responderId) return { error: "ส่งข้อความไม่สำเร็จ" as const };
  // only the poster or the named responder may read/write this thread
  if (userId !== post.poster_id && userId !== responderId) return { error: "ส่งข้อความไม่สำเร็จ" as const };

  const { error } = await supabase
    .from("wanted_post_messages")
    .insert({ wanted_post_id: wantedPostId, responder_id: responderId, sender_id: userId, body: body.trim() });
  if (error) return { error: "ส่งข้อความไม่สำเร็จ" as const };

  revalidatePath(`/wanted/${wantedPostId}/chat`);
  revalidatePath(`/wanted/${wantedPostId}/threads/${responderId}`);
  return { success: true as const };
}
