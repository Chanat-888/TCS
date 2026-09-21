import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";

// Read identity from Auth, never from client metadata or a cookie flag.
export const getSessionUser = cache(async () => {
  const supabase = await createAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || user.is_anonymous) return null;
  return user.phone_confirmed_at || user.email_confirmed_at ? user : null;
});

export async function getSessionUserId(): Promise<string | null> {
  return (await getSessionUser())?.id ?? null;
}

export async function getPhoneVerifiedUserId(): Promise<string | null> {
  const user = await getSessionUser();
  return user?.phone && user.phone_confirmed_at ? user.id : null;
}

// Server actions and selling/checkout pages enforce this independently of UI.
export async function requirePhoneVerifiedUserId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.phone || !user.phone_confirmed_at) redirect("/verify-phone");
  return user.id;
}
