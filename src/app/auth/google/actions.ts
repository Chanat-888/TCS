"use server";

import { cookies } from "next/headers";
import { createAuthClient } from "@/lib/supabase/server";
import { logAuthError } from "@/lib/authLog";

type OAuthProvider = "google" | "custom:line";

const PROVIDERS = {
  google: { name: "Google", scopes: undefined, queryParams: { prompt: "select_account" } },
  // LINE's userinfo endpoint only answers when these scopes were granted.
  "custom:line": { name: "LINE", scopes: "openid profile", queryParams: undefined },
} as const;

async function startOAuth(provider: OAuthProvider, link: boolean) {
  const { name, scopes, queryParams } = PROVIDERS[provider];
  try {
    // Explicit origin avoids trusting forwarded/request host headers.
    const configured = process.env.NEXT_PUBLIC_SITE_URL;
    if (!configured) return { error: `ยังไม่พร้อมเข้าสู่ระบบ ${name} กรุณาติดต่อผู้ดูแล` };
    const site = new URL(configured);
    if (site.protocol !== "https:" && !(site.protocol === "http:" && ["localhost", "127.0.0.1"].includes(site.hostname))) {
      return { error: "การตั้งค่าเว็บไซต์ไม่ถูกต้อง กรุณาติดต่อผู้ดูแล" };
    }
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (link && !user) return { error: `กรุณาเข้าสู่ระบบก่อนเชื่อมบัญชี ${name}` };
    if (!link && user) return { error: `คุณเข้าสู่ระบบแล้ว กรุณาเชื่อม ${name} จากหน้าโปรไฟล์` };

    const options = {
      redirectTo: new URL("/auth/callback", site.origin).toString(),
      skipBrowserRedirect: true,
      ...(scopes ? { scopes } : {}),
      ...(queryParams ? { queryParams } : {}),
    };
    const { data, error } = link
      ? await supabase.auth.linkIdentity({ provider, options })
      : await supabase.auth.signInWithOAuth({ provider, options });
    if (error || !data.url) {
      logAuthError(`start ${name} auth`, error ?? new Error("no authorize URL returned"));
      return { error: `เชื่อมต่อ ${name} ไม่สำเร็จ กรุณาลองอีกครั้ง` };
    }

    const store = await cookies();
    if (link && user) {
      store.set("tcs_link_user", user.id, {
        httpOnly: true, sameSite: "lax", secure: site.protocol === "https:", path: "/", maxAge: 600,
      });
    } else {
      store.delete("tcs_link_user");
    }
    // Google is only ever a backup into an *existing* account, never a way to
    // create one — otherwise anyone could skip LINE entirely and register a
    // second account. Flag this specific flow so the callback can tell "signed
    // into an existing account" apart from "just created a brand new one".
    if (provider === "google" && !link) {
      store.set("tcs_google_recovery", "1", {
        httpOnly: true, sameSite: "lax", secure: site.protocol === "https:", path: "/", maxAge: 600,
      });
    } else {
      store.delete("tcs_google_recovery");
    }
    return { url: data.url };
  } catch (e) {
    logAuthError(`start ${name} auth exception`, e);
    return { error: `เชื่อมต่อ ${name} ไม่สำเร็จ กรุณาลองอีกครั้ง` };
  }
}

export async function startGoogleAuth(link = false) {
  return startOAuth("google", link);
}

export async function startLineAuth(link = false) {
  return startOAuth("custom:line", link);
}
