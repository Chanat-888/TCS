"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/session";
import { cleanBankAccount } from "@/lib/bankAccount";
import { encrypt } from "@/lib/secretBox";

// Saves (or replaces) the signed-in seller's bank account. We keep the number encrypted
// (admins read it to pay withdrawals by hand) plus the last 4 digits for display.
export async function saveBankAccount(input: unknown) {
  const userId = await getSessionUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };
  const cleaned = cleanBankAccount(input);
  if (!cleaned.ok) return { error: cleaned.error };
  const { brand, number, name } = cleaned.value;

  try {
    const { error } = await createServiceClient().from("seller_payout_accounts").upsert({
      user_id: userId,
      omise_recipient_id: null,
      bank_brand: brand,
      account_number_enc: encrypt(number),
      account_last4: number.slice(-4),
      account_name: name,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  } catch (e) {
    console.error("[payout] save bank account failed", (e as Error).message);
    return { error: "บันทึกบัญชีไม่สำเร็จ ตรวจสอบข้อมูลแล้วลองอีกครั้ง" as const };
  }
  revalidatePath("/profile");
  revalidatePath(`/profile/${userId}`);
  return { success: true as const };
}
