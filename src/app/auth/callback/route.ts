import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthClient } from "@/lib/supabase/server";

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

  if (!code || url.searchParams.has("error")) return finish("/auth/error");
  try {
    const supabase = await createAuthClient();
    // PKCE: a code without this browser's verifier cannot create a session.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return finish("/auth/error");
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user || user.is_anonymous || (expectedUserId && user.id !== expectedUserId)) {
      await supabase.auth.signOut({ scope: "local" });
      return finish("/auth/error");
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (profileError || !profile) {
      await supabase.auth.signOut({ scope: "local" });
      return finish("/auth/error");
    }
    // Fixed local destinations: never follow an untrusted next/redirect URL.
    return finish(expectedUserId ? "/profile" : "/browse");
  } catch {
    return finish("/auth/error");
  }
}
