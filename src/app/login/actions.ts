"use server";

import { setSession } from "@/lib/session";

// Stub auth: OTP is not actually sent or checked (see PRODUCT.md — real
// phone-OTP auth is not implemented yet). This just marks the dev session
// as logged in once the client-side OTP step "verifies".
export async function completeLogin() {
  await setSession();
}
