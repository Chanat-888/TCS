"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient, createServiceClient } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/session";
import { omise } from "@/lib/omise";
import { cleanBankAccount } from "@/lib/bankAccount";

// Saves (or replaces) the signed-in seller's bank account as an Omise recipient. The
// account number goes to Omise only; we keep the recipient id and the last 4 digits.
export async function saveBankAccount(input: unknown) {
  const userId = await getSessionUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };
  const cleaned = cleanBankAccount(input);
  if (!cleaned.ok) return { error: cleaned.error };
  const { brand, number, name } = cleaned.value;

  try {
    // Omise requires an email; LINE users may have none, so fall back to a placeholder.
    const { data: { user } } = await (await createAuthClient()).auth.getUser();
    const recipient = await omise<{ id: string }>(
      "/recipients",
      new URLSearchParams({
        name,
        email: user?.email ?? `${userId}@seller.invalid`,
        type: "individual",
        "bank_account[brand]": brand,
        "bank_account[number]": number,
        "bank_account[name]": name,
      }),
    );
    const { error } = await createServiceClient().from("seller_payout_accounts").upsert({
      user_id: userId,
      omise_recipient_id: recipient.id,
      bank_brand: brand,
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
