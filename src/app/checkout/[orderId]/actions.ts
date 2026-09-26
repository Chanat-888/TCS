"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireVerifiedUserId } from "@/lib/session";
import { getAddress, listAddresses } from "@/lib/addressBook";
import { MAX_ADDRESSES, cleanAddressFields, type AddressFields } from "@/lib/addresses";
import type { PaymentMethod } from "@/lib/supabase/types";

export type DeliveryChoice =
  | { type: "saved"; addressId: string }
  | { type: "other"; address: AddressFields; save?: boolean }
  | { type: "meetup" };

export interface PayOrderInput {
  method: PaymentMethod;
  delivery: DeliveryChoice;
}

type Resolved = { error: string } | { deliveryMethod: "ship" | "meetup"; address: AddressFields | null; saveAs: AddressFields | null };

// A saved address is looked up by id AND the session user, never trusted from the
// client, and it is copied into the order so later edits cannot change the order.
async function resolveDelivery(userId: string, delivery: unknown): Promise<Resolved> {
  const choice = (typeof delivery === "object" && delivery !== null ? delivery : {}) as Record<string, unknown>;
  if (choice.type === "meetup") return { deliveryMethod: "meetup", address: null, saveAs: null };

  if (choice.type === "saved") {
    if (typeof choice.addressId !== "string") return { error: "เลือกที่อยู่จัดส่ง" };
    const saved = await getAddress(userId, choice.addressId);
    if (!saved) return { error: "ไม่พบที่อยู่ที่เลือก กรุณาเลือกใหม่" };
    const { recipient, phone, address, province, postcode } = saved;
    return { deliveryMethod: "ship", address: { recipient, phone, address, province, postcode }, saveAs: null };
  }

  if (choice.type === "other") {
    const cleaned = cleanAddressFields(choice.address);
    if (!cleaned.ok) return { error: cleaned.error };
    return { deliveryMethod: "ship", address: cleaned.value, saveAs: choice.save === true ? cleaned.value : null };
  }
  return { error: "เลือกวิธีรับสินค้า" };
}

// Mock escrow: this writes a real PAID_HELD order row and drives the real
// state machine from here on — only the literal payment call is simulated,
// since the payment provider (Omise vs 2C2P) is still undecided (PRODUCT.md).
export async function payOrder(orderId: string, input: PayOrderInput) {
  const userId = await requireVerifiedUserId();
  if (!userId) return { error: "กรุณาเข้าสู่ระบบก่อน" as const };
  if (input?.method !== "promptpay" && input?.method !== "card") return { error: "เลือกวิธีชำระเงิน" as const };

  const supabase = createServiceClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || order.buyer_id !== userId) return { error: "ไม่พบคำสั่งซื้อนี้" as const };
  if (order.status === "CANCELLED") return { error: "คำสั่งซื้อนี้ถูกยกเลิกแล้ว (เกินกำหนดชำระเงิน 24 ชั่วโมง)" as const };
  if (order.status !== "PENDING_PAYMENT") return { error: "คำสั่งซื้อนี้ชำระเงินไปแล้ว" as const };

  const resolved = await resolveDelivery(userId, input.delivery);
  if ("error" in resolved) return { error: resolved.error };

  const { data: claimed, error } = await supabase
    .from("orders")
    .update({
      status: "PAID_HELD",
      payment_method: input.method,
      // 'ship' is the column default, so it is only written for meet-up. That keeps
      // normal checkout working even before the delivery_method migration is applied.
      ...(resolved.deliveryMethod === "meetup" ? { delivery_method: "meetup" } : {}),
      shipping_recipient: resolved.address?.recipient ?? null,
      shipping_phone: resolved.address?.phone ?? null,
      shipping_address: resolved.address?.address ?? null,
      shipping_province: resolved.address?.province ?? null,
      shipping_postcode: resolved.address?.postcode ?? null,
      paid_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", "PENDING_PAYMENT")
    .select("id");
  if (error) return { error: "ชำระเงินไม่สำเร็จ ลองอีกครั้ง" as const };
  // The order timer may have cancelled it (deadline passed) between our read and this
  // update: never report a payment for an order that is no longer waiting for one.
  if (!claimed || claimed.length === 0) return { error: "คำสั่งซื้อนี้ไม่ได้รอชำระเงินแล้ว (อาจถูกยกเลิกเพราะเกินกำหนด) กรุณารีเฟรชหน้า" as const };

  // Saving the address is a convenience: it must never undo or fail a payment.
  if (resolved.saveAs) {
    try {
      const existing = await listAddresses(userId);
      if (existing.length < MAX_ADDRESSES) {
        await supabase.from("profile_addresses").insert({
          ...resolved.saveAs, user_id: userId, label: "ที่อยู่ใหม่", is_default: existing.length === 0,
        });
      }
    } catch (e) {
      console.error("[checkout] could not save address", (e as { code?: string }).code);
    }
  }

  revalidatePath(`/checkout/${orderId}`);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/profile");
  return { success: true as const, deliveryMethod: resolved.deliveryMethod };
}
