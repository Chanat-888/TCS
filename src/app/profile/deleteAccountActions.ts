"use server";

import { createAuthClient, createServiceClient } from "@/lib/supabase/server";
import { logAuthError } from "@/lib/authLog";
import { AVATAR_STORAGE_PATH_PREFIX } from "@/lib/avatar";
import { DELETED_DISPLAY_NAME } from "@/lib/profileName";

// Orders in any of these statuses still need the account to exist: money is
// in flight, a delivery is pending, or a dispute is open. Only a finished
// order (paid out, cancelled, or refunded) is safe to leave behind.
const OPEN_ORDER_STATUSES = ["PENDING_PAYMENT", "PAID_HELD", "SHIPPED", "DELIVERED", "DISPUTED"] as const;

async function findBlockers(userId: string): Promise<string[]> {
  const supabase = createServiceClient();
  const blockers: string[] = [];

  const { count: openOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .in("status", OPEN_ORDER_STATUSES);
  if ((openOrders ?? 0) > 0) blockers.push("คุณมีคำสั่งซื้อ/ขายที่ยังไม่เสร็จสิ้น รอให้จัดส่ง ได้รับเงิน หรือปิดข้อพิพาทก่อน");

  const { count: activeListings } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", userId)
    .eq("status", "active");
  if ((activeListings ?? 0) > 0) blockers.push("คุณมีประกาศขายที่ยังเปิดอยู่ กรุณาปิดหรือยกเลิกประกาศก่อน");

  const { data: bidRows } = await supabase.from("bids").select("listing_id").eq("bidder_id", userId);
  const biddedListingIds = [...new Set((bidRows ?? []).map((b) => b.listing_id))];
  if (biddedListingIds.length > 0) {
    const { count: activeBids } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .in("id", biddedListingIds)
      .eq("status", "active");
    if ((activeBids ?? 0) > 0) blockers.push("คุณมีการประมูลที่ยังไม่จบ รอให้การประมูลนั้นจบก่อน");
  }

  return blockers;
}

// is_admin, verified and tier all live on this profile row and never follow
// the person anywhere — deleting the account they happen to be an admin on
// does not make any other account an admin. Not a reason to block deletion
// (a legitimate handover might be exactly why), just to say so out loud
// before it happens, since that flag going quietly missing is easy to miss.
async function findWarnings(userId: string): Promise<string[]> {
  const supabase = createServiceClient();
  const warnings: string[] = [];
  const { data: profile } = await supabase.from("profiles").select("is_admin, verified, tier").eq("id", userId).maybeSingle();
  if (profile?.is_admin) warnings.push("บัญชีนี้เป็นผู้ดูแลระบบ (is_admin) — สิทธิ์นี้จะไม่โอนไปที่บัญชีอื่นโดยอัตโนมัติ ตั้งค่าแอดมินคนใหม่ก่อนลบ หากนี่คือแอดมินคนเดียวที่เหลืออยู่");
  if (profile?.verified) warnings.push("บัญชีนี้ยืนยันตัวตนผู้ขายแล้ว — สถานะนี้จะหายไปและไม่โอนไปที่บัญชีอื่น");
  if (profile?.tier) warnings.push(`บัญชีนี้อยู่ระดับ ${profile.tier} — ระดับนี้จะหายไปและไม่โอนไปที่บัญชีอื่น`);
  return warnings;
}

/** What would stop deletion right now, without deleting anything — lets the
 * confirmation screen tell the user why before they commit to it. */
export async function getAccountDeletionBlockers(): Promise<{ blockers: string[]; warnings: string[] } | { error: string }> {
  try {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "กรุณาเข้าสู่ระบบก่อน" };
    const [blockers, warnings] = await Promise.all([findBlockers(user.id), findWarnings(user.id)]);
    return { blockers, warnings };
  } catch (e) {
    logAuthError("get account deletion blockers exception", e);
    return { error: "ตรวจสอบไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}

// Never a hard delete of the profiles row: listings, orders, bids, disputes,
// reviews and messages all reference it with no cascade, and a real
// marketplace needs those historical records to keep resolving to *someone*.
// Instead: check nothing is still in flight, scrub the identifying fields in
// place, drop the private address book and any uploaded photo, then remove
// the Auth login entirely so the person can never sign in again.
export async function deleteMyAccount(): Promise<{ success: true } | { error: string; blockers?: string[] }> {
  try {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "กรุณาเข้าสู่ระบบก่อน" };
    const userId = user.id;

    const blockers = await findBlockers(userId);
    if (blockers.length > 0) return { error: "ลบบัญชีไม่ได้ในตอนนี้", blockers };

    const service = createServiceClient();

    const { data: profile } = await service.from("profiles").select("avatar_url").eq("id", userId).maybeSingle();
    await service.from("profile_addresses").delete().eq("user_id", userId);

    const avatarUrl = profile?.avatar_url;
    if (avatarUrl) {
      try {
        const path = new URL(avatarUrl).pathname;
        if (path.startsWith(AVATAR_STORAGE_PATH_PREFIX)) {
          const objectPath = decodeURIComponent(path.slice(AVATAR_STORAGE_PATH_PREFIX.length));
          if (objectPath.startsWith(`${userId}/`)) await service.storage.from("avatars").remove([objectPath]);
        }
      } catch {
        // Not a URL, or not our bucket — nothing of ours to clean up.
      }
    }

    const { error: anonymizeError } = await service
      .from("profiles")
      .update({ display_name: DELETED_DISPLAY_NAME, avatar_initial: "?", bio: "", phone: null, avatar_url: null, deleted_at: new Date().toISOString() })
      .eq("id", userId);
    if (anonymizeError) {
      logAuthError("delete account: anonymize profile", anonymizeError);
      return { error: "ลบบัญชีไม่สำเร็จ กรุณาลองอีกครั้งหรือติดต่อผู้ดูแล" };
    }

    await supabase.auth.signOut({ scope: "global" });

    const { error: deleteAuthError } = await service.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      // The profile is already scrubbed and the person is signed out; only
      // the Auth row itself failed to go, which an admin can clean up by
      // hand. Reporting success here would be a lie the person could act on
      // (e.g. re-registering, expecting a clean slate) if it silently failed.
      logAuthError("delete account: remove auth user", deleteAuthError);
      return { error: "บัญชีถูกลบข้อมูลแล้ว แต่ยังไม่สามารถปิดการเข้าสู่ระบบได้ กรุณาติดต่อผู้ดูแล" };
    }

    return { success: true };
  } catch (e) {
    logAuthError("delete account exception", e);
    return { error: "ลบบัญชีไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}
