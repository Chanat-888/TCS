import type { DisputeReason } from "@/lib/supabase/types";

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  condition: "สภาพการ์ดไม่ตรงกับที่ประกาศขาย",
  wrong: "ได้รับการ์ดผิดใบ",
  authenticity: "สงสัยว่าการ์ดไม่ใช่ของแท้",
  other: "อื่นๆ",
  not_received: "ไม่ได้รับสินค้า (นัดรับ)",
};
