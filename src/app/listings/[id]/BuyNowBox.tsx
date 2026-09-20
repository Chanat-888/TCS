"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatTHB } from "@/lib/format";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { buyNow } from "./actions";

export function BuyNowBox({
  listingId,
  price,
  isOwner,
  isSold,
}: {
  listingId: string;
  price: number;
  isOwner: boolean;
  isSold: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleBuyNow() {
    setSubmitting(true);
    setError("");
    const result = await buyNow(listingId);
    if ("error" in result) {
      setSubmitting(false);
      setError(result.error ?? "เกิดข้อผิดพลาด ลองอีกครั้ง");
      return;
    }
    router.push(`/checkout/${result.orderId}`);
  }

  return (
    <div className="mt-[22px] rounded-2xl p-[22px]" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
      <p className="text-[12px]" style={{ color: "var(--steel)" }}>
        ราคาซื้อทันที
      </p>
      <p className="mono mt-1 text-[30px]" style={{ color: "var(--white)" }}>
        {formatTHB(price)}
      </p>

      {isOwner ? (
        <p className="mt-[18px] text-[13px]" style={{ color: "var(--steel)" }}>
          นี่คือประกาศของคุณเอง — ไม่สามารถซื้อประกาศของตัวเองได้
        </p>
      ) : isSold ? (
        <p className="mt-[18px] text-[13px]" style={{ color: "var(--steel)" }}>
          สินค้านี้ถูกขายไปแล้ว
        </p>
      ) : (
        <>
          {error && (
            <p className="mt-2 text-[12.5px]" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
          <div className="mt-[18px]">
            <PrimaryButton loading={submitting} onClick={handleBuyNow}>
              ซื้อทันที
            </PrimaryButton>
          </div>
        </>
      )}
    </div>
  );
}
