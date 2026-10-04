"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireVerifiedUserId } from "@/lib/session";

function refreshWantedPages() {
  revalidatePath("/profile");
  revalidatePath("/browse");
  revalidatePath("/search");
}

const MAX_CHAT_MESSAGE_LENGTH = 1000;

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
  if (body.trim().length > MAX_CHAT_MESSAGE_LENGTH) return { error: `ข้อความยาวเกินไป (สูงสุด ${MAX_CHAT_MESSAGE_LENGTH} ตัวอักษร)` as const };

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

/** One wanted-post thread, for the live refresh. Only the poster and that responder may read it. */
export async function getWantedThreadMessages(wantedPostId: string, responderId: string) {
  const userId = await requireVerifiedUserId();
  const supabase = createServiceClient();
  const { data: post } = await supabase.from("wanted_posts").select("poster_id").eq("id", wantedPostId).maybeSingle();
  if (!post || (userId !== post.poster_id && userId !== responderId)) return { error: "ไม่พบข้อความ" as const };
  const { data, error } = await supabase
    .from("wanted_post_messages")
    .select("id, sender_id, body, created_at")
    .eq("wanted_post_id", wantedPostId)
    .eq("responder_id", responderId)
    .order("created_at", { ascending: true });
  if (error) return { error: "โหลดข้อความไม่สำเร็จ" as const };
  return { messages: data ?? [] };
}
