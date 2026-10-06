"use client";

import { useRef, useState } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { prepareCardPhoto } from "@/lib/clientImage";

/** Uploads the transfer slip. The server only stores it; an admin confirms the payment. */
export function SlipUpload({ orderId, onSent }: { orderId: string; onSent: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const file = input.current?.files?.[0];
    if (!file) return setError("เลือกรูปสลิปก่อน");
    setBusy(true);
    setError("");
    try {
      const prepared = await prepareCardPhoto(file);
      if (!prepared.ok) return setError(prepared.error);
      const formData = new FormData();
      formData.set("slip", prepared.file);
      const res = await fetch(`/api/orders/${orderId}/slip`, { method: "POST", body: formData });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return setError(body.error ?? "ส่งสลิปไม่สำเร็จ กรุณาลองอีกครั้ง");
      onSent();
    } catch {
      setError("ส่งสลิปไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 flex flex-col gap-3 text-left">
      <label className="flex flex-col gap-1 text-[13px]" style={{ color: "var(--steel)" }}>
        โอนเสร็จแล้ว แนบสลิปการโอน
        <input ref={input} type="file" accept="image/*" style={{ width: "100%", fontSize: 13.5 }} />
      </label>
      {error && <p role="alert" className="text-[12.5px]" style={{ color: "var(--danger)" }}>{error}</p>}
      <PrimaryButton loading={busy} onClick={submit}>ส่งสลิป</PrimaryButton>
    </div>
  );
}
