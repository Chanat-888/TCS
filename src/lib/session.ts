import "server-only";
import { cookies } from "next/headers";

// Stub auth: real phone-OTP / Supabase Auth is not wired up yet (see
// PRODUCT.md "Open/undecided product facts"). "Logging in" just sets a
// cookie flag; the identity behind it is always this one seeded dev profile.
// Swap this file for real Supabase Auth session lookup once that lands.
export const DEV_USER_ID = "a0000000-0000-0000-0000-000000000001";

const SESSION_COOKIE = "tcs_session";

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value === "1" ? DEV_USER_ID : null;
}

export async function setSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
