"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireVerifiedUserId } from "@/lib/session";
import type { ListingCategory } from "@/lib/supabase/types";

const WANTED_CATEGORIES: ListingCategory[] = ["new", "deck", "rare"];
const MAX_TEXT = 120;
const MAX_NOTE = 400;
const MAX_BUDGET = 10_000_000;

/** Reads and checks the create/edit form; null means something is missing or out of range. */
function parseWantedForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const setName = String(formData.get("set") ?? "").trim();
  const category = String(formData.get("category") ?? "") as ListingCategory;
  const maxPrice = parseInt(String(formData.get("maxPrice") ?? ""), 10);
  const note = String(formData.get("note") ?? "").trim();
  if (!name || !setName || name.length > MAX_TEXT || setName.length > MAX_TEXT) return null;
  if (!WANTED_CATEGORIES.includes(category)) return null;
  if (!Number.isInteger(maxPrice) || maxPrice < 1 || maxPrice > MAX_BUDGET) return null;
  if (note.length > MAX_NOTE) return null;
  return { name, set_name: setName, category, max_price: maxPrice, note };
}

function refreshWantedPages() {
  revalidatePath("/profile");
  revalidatePath("/browse");
  revalidatePath("/search");
}

export async function createWantedPost(formData: FormData) {
  const userId = await requireVerifiedUserId();

  const fields = parseWantedForm(formData);
  if (!fields) redirect("/wanted/new?error=1");

  const supabase = createServiceClient();
  const { error } = await supabase.from("wanted_posts").insert({ poster_id: userId, ...fields });
  if (error) redirect("/wanted/new?error=1");

  refreshWantedPages();
  redirect("/profile");
}

/** Poster edits their own open post. A closed post stays as it was. */
export async function updateWantedPost(postId: string, formData: FormData) {
  const userId = await requireVerifiedUserId();

  const fields = parseWantedForm(formData);
  if (!fields) redirect(`/wanted/${postId}/edit?error=1`);

  const supabase = createServiceClient();
  const { data: updated, error } = await supabase
    .from("wanted_posts")
    .update(fields)
    .eq("id", postId)
    .eq("poster_id", userId)
    .eq("status", "active")
    .select("id");
  if (error || !updated?.length) redirect(`/wanted/${postId}/edit?error=1`);

  refreshWantedPages();
  redirect("/profile");
}

/** Poster takes their post down (e.g. they found the card). It disappears from browse and search; existing chats stay readable. */
export async function closeWantedPost(postId: string) {
  const userId = await requireVerifiedUserId();

  const supabase = createServiceClient();
  const { data: closed, error } = await supabase
    .from("wanted_posts")
    .update({ status: "closed" })
    .eq("id", postId)
    .eq("poster_id", userId)
    .eq("status", "active")
    .select("id");
  if (error) return { error: "ปิดประกาศไม่สำเร็จ ลองอีกครั้ง" as const };
  if (!closed?.length) return { error: "ไม่พบประกาศนี้หรือปิดไปแล้ว" as const };

  refreshWantedPages();
  return { success: true as const };
}

export async function sendWantedPostMessage(wantedPostId: string, responderId: string, body: string) {
  const userId = await requireVerifiedUserId();
  if (!body.trim()) return { error: "ส่งข้อความไม่สำเร็จ" as const };

  const supabase = createServiceClient();
  const { data: post } = await supabase.from("wanted_posts").select("poster_id, status").eq("id", wantedPostId).maybeSingle();
  if (!post || post.poster_id === responderId) return { error: "ส่งข้อความไม่สำเร็จ" as const };
  // only the poster or the named responder may read/write this thread
  if (userId !== post.poster_id && userId !== responderId) return { error: "ส่งข้อความไม่สำเร็จ" as const };
  if (post.status !== "active") return { error: "ประกาศนี้ปิดแล้ว ส่งข้อความเพิ่มไม่ได้" as const };

  const { error } = await supabase
    .from("wanted_post_messages")
    .insert({ wanted_post_id: wantedPostId, responder_id: responderId, sender_id: userId, body: body.trim() });
  if (error) return { error: "ส่งข้อความไม่สำเร็จ" as const };

  revalidatePath(`/wanted/${wantedPostId}/chat`);
  revalidatePath(`/wanted/${wantedPostId}/threads/${responderId}`);
  return { success: true as const };
}
