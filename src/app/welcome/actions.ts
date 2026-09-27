"use server";

import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/session";

const DESTINATIONS = ["/browse", "/listings/new", "/profile"] as const;

// Marks the welcome page as seen (first time only) and leaves for a fixed local page.
export async function finishWelcome(dest: (typeof DESTINATIONS)[number]) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const { error } = await createServiceClient()
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", userId)
    .is("onboarded_at", null);
  if (error) console.error("welcome finish failed", error.code);
  redirect(DESTINATIONS.includes(dest) ? dest : "/browse");
}
