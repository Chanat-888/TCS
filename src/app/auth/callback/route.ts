import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthClient } from "@/lib/supabase/server";
import { logAuthError } from "@/lib/authLog";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const store = await cookies();
  const expectedUserId = store.get("tcs_link_user")?.value;
  store.delete("tcs_link_user");
  const finish = (path: string) => {
    const response = NextResponse.redirect(new URL(path, url.origin));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };

  if (!code || url.searchParams.has("error")) {
    logAuthError("oauth callback", {
      code: url.searchParams.get("error_code") ?? url.searchParams.get("error") ?? undefined,
      message: url.searchParams.get("error_description") ?? (code ? "provider returned an error" : "no code in callback"),
    });
    return finish("/auth/error");
  }
  try {
    const supabase = await createAuthClient();
    // PKCE: a code without this browser's verifier cannot create a session.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logAuthError("oauth code exchange", error);
      return finish("/auth/error");
    }
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user || user.is_anonymous || (expectedUserId && user.id !== expectedUserId)) {
      logAuthError("oauth callback: user check", userError ?? new Error("no user, anonymous user, or linked-account mismatch"));
      await supabase.auth.signOut({ scope: "local" });
      return finish("/auth/error");
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (profileError || !profile) {
      logAuthError("oauth callback: profile", profileError ?? new Error("no profile row for the signed-in user (is migration 0006 applied?)"));
      await supabase.auth.signOut({ scope: "local" });
      return finish("/auth/error");
    }
    // Fixed local destinations: never follow an untrusted next/redirect URL.
    return finish(expectedUserId ? "/profile" : "/browse");
  } catch (e) {
    logAuthError("oauth callback exception", e);
    return finish("/auth/error");
  }
}
