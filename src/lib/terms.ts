import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { TERMS_VERSION } from "@/lib/termsConfig";

export async function hasAcceptedTerms(userId: string): Promise<boolean> {
  const { count } = await createServiceClient()
    .from("terms_acceptances")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("version", TERMS_VERSION);
  return (count ?? 0) > 0;
}

/** Pages that sell, withdraw or pay: send the user to the consent step first, then back to `next`. */
export async function requireTerms(userId: string, next: string) {
  if (!(await hasAcceptedTerms(userId))) redirect(`/terms/accept?next=${encodeURIComponent(next)}`);
}

/** Writes the consent row (user, version, time, IP). Accepting the same version twice adds nothing. */
export async function recordAcceptance(userId: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip");
  const { error } = await createServiceClient()
    .from("terms_acceptances")
    .upsert({ user_id: userId, version: TERMS_VERSION, ip }, { onConflict: "user_id,version", ignoreDuplicates: true });
  return !error;
}

export const TERMS_REQUIRED = { error: "กรุณายอมรับข้อกำหนดการใช้งานก่อน", code: "TERMS_REQUIRED" } as const;
