"use server";

import { createAuthClient } from "@/lib/supabase/server";
import { normalizeThaiPhone } from "@/lib/phone";
import { logAuthError } from "@/lib/authLog";

function authError(code?: string) {
  if (code === "over_sms_send_rate_limit" || code === "over_request_rate_limit") {
    return "ขอรหัสบ่อยเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง";
  }
  if (code === "otp_expired") return "รหัสไม่ถูกต้องหรือหมดอายุ กรุณาลองอีกครั้งหรือขอรหัสใหม่";
  return "ไม่สามารถยืนยันหรือส่งรหัสได้ในขณะนี้ กรุณาลองอีกครั้ง";
}

export async function sendPhoneOtp(input: string) {
  const phone = normalizeThaiPhone(input);
  if (!phone) return { error: "กรุณากรอกเบอร์มือถือไทยให้ถูกต้อง" };
  try {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) {
      logAuthError("sendPhoneOtp", error);
      return { error: authError(error.code) };
    }
    return { success: true, phone };
  } catch (e) {
    logAuthError("login action exception", e);
    return { error: "เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง" };
  }
}

export async function verifyPhoneOtp(input: string, token: string) {
  const phone = normalizeThaiPhone(input);
  if (!phone || typeof token !== "string" || !/^\d{6}$/.test(token)) {
    return { error: "กรุณากรอกเบอร์โทรและรหัส 6 หลักให้ถูกต้อง" };
  }
  try {
    const supabase = await createAuthClient();
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
    if (error || !data.user?.phone_confirmed_at || !data.session) {
      logAuthError("verifyPhoneOtp", error ?? new Error("verification returned no confirmed session"));
      return { error: authError(error?.code) };
    }
    // Migration 0006 creates a distinct profile for every Auth user.
    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("id").eq("id", data.user.id).maybeSingle();
    if (profileError || !profile) {
      logAuthError("verifyPhoneOtp:profile", profileError ?? new Error("no profile row for the signed-in user (is migration 0006 applied?)"));
      await supabase.auth.signOut({ scope: "local" });
      return { error: "สร้างโปรไฟล์ไม่สำเร็จ กรุณาติดต่อผู้ดูแล" };
    }
    return { success: true };
  } catch (e) {
    logAuthError("login action exception", e);
    return { error: "เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง" };
  }
}
