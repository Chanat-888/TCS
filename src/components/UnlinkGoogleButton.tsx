"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { unlinkGoogle } from "@/app/profile/accountActions";

export function UnlinkGoogleButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  async function unlink() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await unlinkGoogle();
      if ("error" in result) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mt-2">
      {confirming ? (
        <p className="text-[13px]" style={{ color: "var(--steel)" }}>
          ยกเลิกการเชื่อม Google? คุณจะใช้ Google เข้าบัญชีนี้ไม่ได้อีก{" "}
          <button type="button" onClick={unlink} disabled={pending}
            className="border-0 bg-transparent p-0 text-[13px] font-medium cursor-pointer disabled:opacity-50" style={{ color: "var(--danger)" }}>
            {pending ? "กำลังยกเลิก…" : "ยืนยัน"}
          </button>
          {" · "}
          <button type="button" onClick={() => setConfirming(false)} disabled={pending}
            className="border-0 bg-transparent p-0 text-[13px] cursor-pointer" style={{ color: "var(--steel)" }}>
            ไม่ยกเลิก
          </button>
        </p>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}
          className="border-0 bg-transparent p-0 text-[13px] cursor-pointer underline" style={{ color: "var(--steel)" }}>
          ยกเลิกการเชื่อม Google
        </button>
      )}
      {error && <p role="alert" className="mt-2 text-[13px]" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
