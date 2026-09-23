import "server-only";
import { createPublicClient, createServiceClient } from "@/lib/supabase/server";
import type { Profile, WantedPost, WantedPostMessage } from "@/lib/supabase/types";

export type WantedPostWithPoster = WantedPost & { poster: Profile };

export async function getActiveWantedPosts(): Promise<WantedPostWithPoster[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("wanted_posts")
    .select("*, poster:profiles(*)")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as WantedPostWithPoster[];
}

/** Matches active wanted posts whose name or set contains `query` (case-insensitive). */
export async function searchWantedPosts(query: string): Promise<WantedPostWithPoster[]> {
  const supabase = createPublicClient();
  const pattern = `%${query.trim()}%`;
  const [byName, bySet] = await Promise.all([
    supabase.from("wanted_posts").select("*, poster:profiles(*)").eq("status", "active").ilike("name", pattern).order("created_at", { ascending: false }),
    supabase.from("wanted_posts").select("*, poster:profiles(*)").eq("status", "active").ilike("set_name", pattern).order("created_at", { ascending: false }),
  ]);
  if (byName.error) throw byName.error;
  if (bySet.error) throw bySet.error;

  const seen = new Set<string>();
  const merged: WantedPostWithPoster[] = [];
  for (const row of [...(byName.data ?? []), ...(bySet.data ?? [])] as unknown as WantedPostWithPoster[]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}

export async function getWantedPostsByPoster(posterId: string): Promise<WantedPost[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("wanted_posts")
    .select("*")
    .eq("poster_id", posterId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as WantedPost[];
}

export async function getWantedPostById(id: string): Promise<WantedPost | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("wanted_posts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as WantedPost | null;
}

/** One private thread between the poster and a single responder. Server-only
 * (see 0009_wanted_posts.sql) — callers must verify the requester is a party
 * to the thread before calling this. */
export async function getWantedPostThread(wantedPostId: string, responderId: string): Promise<WantedPostMessage[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("wanted_post_messages")
    .select("*")
    .eq("wanted_post_id", wantedPostId)
    .eq("responder_id", responderId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as WantedPostMessage[];
}

export type WantedPostThreadSummary = { responder: Profile; lastMessage: string; lastMessageAt: string };

/** Poster-only inbox: one row per person who has messaged about this post. */
export async function getWantedPostThreads(wantedPostId: string): Promise<WantedPostThreadSummary[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("wanted_post_messages")
    .select("responder_id, body, created_at, responder:profiles!wanted_post_messages_responder_id_fkey(*)")
    .eq("wanted_post_id", wantedPostId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const byResponder = new Map<string, WantedPostThreadSummary>();
  for (const row of (data ?? []) as unknown as { responder_id: string; body: string; created_at: string; responder: Profile }[]) {
    byResponder.set(row.responder_id, { responder: row.responder, lastMessage: row.body, lastMessageAt: row.created_at });
  }
  return Array.from(byResponder.values()).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}
