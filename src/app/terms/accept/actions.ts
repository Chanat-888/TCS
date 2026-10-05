"use server";

import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { recordAcceptance } from "@/lib/terms";
import { safeNext } from "@/lib/termsConfig";

export async function acceptTerms(next: string) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  if (!(await recordAcceptance(userId))) return { error: "บันทึกไม่สำเร็จ ลองอีกครั้ง" as const };
  redirect(safeNext(next));
}
