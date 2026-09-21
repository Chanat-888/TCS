"use server";

import { createAuthClient } from "@/lib/supabase/server";
import { normalizeThaiPhone } from "@/lib/phone";

const failure = "ยืนยันเบอร์ไม่สำเร็จ รหัสอาจผิดหรือหมดอายุ กรุณาลองอีกครั้ง";
function phoneError(code?: string) {
  if (code === "phone_exists" || code === "user_already_exists") {
    return "เบอร์นี้มีบัญชี TCS แล้ว กรุณาเข้าสู่ระบบด้วยเบอร์เดิม แล้วเชื่อม Google จากหน้าโปรไฟล์ หาก Google นี้มีบัญชีแล้วให้ติดต่อผู้ดูแล";
  }
  if (code === "over_sms_send_rate_limit" || code === "over_request_rate_limit") {
    return "ขอรหัสบ่อยเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง";
  }
  return failure;
}

export async function sendVerificationOtp(input: string) {
  const phone = normalizeThaiPhone(input);
  if (!phone) return { error: "กรุณากรอกเบอร์มือถือไทยให้ถูกต้อง" };
  try {
    const supabase = await createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.is_anonymous) return { error: "กรุณาเข้าสู่ระบบก่อนยืนยันเบอร์โทร" };
    if (user.phone && user.phone_confirmed_at) return { error: "บัญชีนี้ยืนยันเบอร์โทรแล้ว" };
    // Attach phone to the signed-in UUID; do not create/sign into another account.
    const { error } = await supabase.auth.updateUser({ phone });
    return error ? { error: phoneError(error.code) } : { success: true };
  } catch {
    return { error: "เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง" };
  }
}

export async function verifyAccountPhone(input: string, token: string) {
  const phone = normalizeThaiPhone(input);
  if (!phone || typeof token !== "string" || !/^\d{6}$/.test(token)) return { error: failure };
  try {
    const supabase = await createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.is_anonymous) return { error: "กรุณาเข้าสู่ระบบก่อนยืนยันเบอร์โทร" };
    if (user.phone && user.phone_confirmed_at) return { error: "บัญชีนี้ยืนยันเบอร์โทรแล้ว" };
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "phone_change" });
    if (error) return { error: phoneError(error.code) };
    if (data.user?.id !== user.id) {
      await supabase.auth.signOut({ scope: "local" });
      return { error: failure };
    }
    if (!data.session || !data.user.phone_confirmed_at ||
        normalizeThaiPhone(data.user.phone) !== phone) return { error: failure };
    return { success: true };
  } catch {
    return { error: "เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง" };
  }
}
