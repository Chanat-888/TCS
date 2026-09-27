import "server-only";
import type { createServiceClient } from "@/lib/supabase/server";

type Supabase = ReturnType<typeof createServiceClient>;

export type NotificationType = "outbid" | "auction_won" | "auction_ended" | "auction_ending_soon";

/**
 * Records one notification for one user. Best-effort: a notification failing
 * to write must never break the bid, order, or timer step that triggered it,
 * so errors are swallowed rather than surfaced.
 */
export async function notify(
  supabase: Supabase,
  params: { userId: string; type: NotificationType; title: string; body?: string; listingId?: string; orderId?: string }
) {
  try {
    await supabase.from("notifications").insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      listing_id: params.listingId ?? null,
      order_id: params.orderId ?? null,
    });
  } catch {
    // best effort — see above
  }
}

/** Notifies everyone watching a listing, except whoever is passed in `exclude` (e.g. the winner, already told separately). */
export async function notifyWatchers(
  supabase: Supabase,
  listingId: string,
  params: { type: NotificationType; title: string; body?: string; exclude?: string[] }
) {
  try {
    const { data: watchers } = await supabase.from("watchlist").select("user_id").eq("listing_id", listingId);
    const exclude = new Set(params.exclude ?? []);
    for (const w of watchers ?? []) {
      if (exclude.has(w.user_id)) continue;
      await notify(supabase, { userId: w.user_id, type: params.type, title: params.title, body: params.body, listingId });
    }
  } catch {
    // best effort — see above
  }
}
