"use server";

import { cookies } from "next/headers";
import { createAuthClient } from "@/lib/supabase/server";

export async function startGoogleAuth(link = false) {
  try {
    // Explicit origin avoids trusting forwarded/request host headers.
    const configured = process.env.NEXT_PUBLIC_SITE_URL;
    if (!configured) return { error: "ยังไม่พร้อมเข้าสู่ระบบ Google กรุณาติดต่อผู้ดูแล" };
    const site = new URL(configured);
    if (site.protocol !== "https:" && !(site.protocol === "http:" && ["localhost", "127.0.0.1"].includes(site.hostname))) {
      return { error: "การตั้งค่าเว็บไซต์ไม่ถูกต้อง กรุณาติดต่อผู้ดูแล" };
    }
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (link && !user) return { error: "กรุณาเข้าสู่ระบบก่อนเชื่อมบัญชี Google" };
    if (!link && user) return { error: "คุณเข้าสู่ระบบแล้ว กรุณาเชื่อม Google จากหน้าโปรไฟล์" };

    const options = {
      redirectTo: new URL("/auth/callback", site.origin).toString(),
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    };
    const { data, error } = link
      ? await supabase.auth.linkIdentity({ provider: "google", options })
      : await supabase.auth.signInWithOAuth({ provider: "google", options });
    if (error || !data.url) return { error: "เชื่อมต่อ Google ไม่สำเร็จ กรุณาลองอีกครั้ง" };

    const store = await cookies();
    if (link && user) {
      store.set("tcs_link_user", user.id, {
        httpOnly: true, sameSite: "lax", secure: site.protocol === "https:", path: "/", maxAge: 600,
      });
    } else {
      store.delete("tcs_link_user");
    }
    return { url: data.url };
  } catch {
    return { error: "เชื่อมต่อ Google ไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}
