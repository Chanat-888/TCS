"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requirePhoneVerifiedUserId } from "@/lib/session";
import type { PaymentMethod } from "@/lib/supabase/types";

export interface PayOrderInput {
  recipient: string;
  phone: string;
  address: string;
  province: string;
  postcode: string;
  method: PaymentMethod;
}

// Mock escrow: this writes a real PAID_HELD order row and drives the real
// state machine from here on — only the literal payment call is simulated,
// since the payment provider (Omise vs 2C2P) is still undecided (PRODUCT.md).
export async function payOrder(orderId: string, input: PayOrderInput) {
  const userId = await requirePhoneVerifiedUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };

  const supabase = createServiceClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || order.buyer_id !== userId) return { error: "ไม่พบคำสั่งซื้อนี้" as const };
  if (order.status !== "PENDING_PAYMENT") return { error: "คำสั่งซื้อนี้ชำระเงินไปแล้ว" as const };

  const { error } = await supabase
    .from("orders")
    .update({
      status: "PAID_HELD",
      payment_method: input.method,
      shipping_recipient: input.recipient,
      shipping_phone: input.phone,
      shipping_address: input.address,
      shipping_province: input.province,
      shipping_postcode: input.postcode,
      paid_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) return { error: "ชำระเงินไม่สำเร็จ ลองอีกครั้ง" as const };

  revalidatePath(`/checkout/${orderId}`);
  revalidatePath(`/orders/${orderId}`);
  return { success: true as const };
}
