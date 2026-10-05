"use client";

import { useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { prepareCardPhoto } from "@/lib/clientImage";

const fileStyle: CSSProperties = { width: "100%", fontSize: 13.5, color: "var(--steel)" };

/** Upload form for the ID check. The server keeps the files until an admin decides, then deletes them. */
export function IdentityCheckForm() {
  const router = useRouter();
  const selfieInput = useRef<HTMLInputElement>(null);
  const cardInput = useRef<HTMLInputElement>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const selfie = selfieInput.current?.files?.[0];
    const card = cardInput.current?.files?.[0];
    if (!selfie || !card) return setError("เลือกรูปเซลฟี่คู่บัตรและรูปหน้าบัตรให้ครบ");
    setBusy(true);
    setError("");
    try {
      const [a, b] = await Promise.all([prepareCardPhoto(selfie), prepareCardPhoto(card)]);
      if (!a.ok) return setError(a.error);
      if (!b.ok) return setError(b.error);
      const formData = new FormData();
      formData.set("selfie", a.file);
      formData.set("card", b.file);
      if (consent) formData.set("consent", "on");
      const res = await fetch("/api/seller/identity", { method: "POST", body: formData });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return setError(body.error ?? "ส่งไม่สำเร็จ กรุณาลองอีกครั้ง");
      router.refresh();
    } catch {
      setError("ส่งไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[13px]">
        เซลฟี่ถือบัตรประชาชนข้างใบหน้า
        <input ref={selfieInput} type="file" accept="image/*" style={fileStyle} />
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        รูปหน้าบัตรประชาชน (ปิดบรรทัดศาสนาได้)
        <input ref={cardInput} type="file" accept="image/*" style={fileStyle} />
      </label>
      <label className="flex cursor-pointer items-start gap-2 text-[12.5px] leading-[1.6]" style={{ color: "var(--steel)" }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 shrink-0" />
        <span>ฉันยินยอมให้ TCS ใช้รูปนี้ตรวจสอบตัวตนเท่านั้น และลบรูปทันทีหลังตรวจเสร็จ</span>
      </label>
      {error && <p role="alert" className="text-[12.5px]" style={{ color: "var(--danger)" }}>{error}</p>}
      <PrimaryButton loading={busy} disabled={!consent} onClick={submit}>ส่งให้ตรวจสอบ</PrimaryButton>
    </div>
  );
}
