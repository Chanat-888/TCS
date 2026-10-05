"use server";

import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/session";
import { recordAcceptance } from "@/lib/terms";

const DESTINATIONS = ["/browse", "/listings/new", "/profile"] as const;

// Marks the welcome page as seen (first time only) and leaves for a fixed local page.
// Ticking the terms box here records consent; skipping it is fine, selling asks again later.
export async function finishWelcome(dest: (typeof DESTINATIONS)[number], acceptedTerms = false) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  if (acceptedTerms) await recordAcceptance(userId);
  const { error } = await createServiceClient()
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", userId)
    .is("onboarded_at", null);
  if (error) console.error("welcome finish failed", error.code);
  redirect(DESTINATIONS.includes(dest) ? dest : "/browse");
}
