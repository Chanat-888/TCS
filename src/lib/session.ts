import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";

// Providers whose sign-in is accepted even when they return no email or phone
// (many LINE accounts have no email). Read from the identities the Auth server
// attaches to the user, never from user-editable metadata.
const TRUSTED_SIGN_IN_PROVIDERS = ["custom:line", "line"];

// Read identity from Auth, never from client metadata or a cookie flag.
export const getSessionUser = cache(async () => {
  const supabase = await createAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || user.is_anonymous) return null;
  const trustedProvider = user.identities?.some((identity) => TRUSTED_SIGN_IN_PROVIDERS.includes(identity.provider));
  return user.phone_confirmed_at || user.email_confirmed_at || trustedProvider ? user : null;
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
