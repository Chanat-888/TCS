"use client";

import { useRef, useState } from "react";
import { startGoogleAuth } from "@/app/auth/google/actions";

export function GoogleAuthButton({ link = false, disabled = false }: { link?: boolean; disabled?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  async function begin() {
    if (busy.current || disabled) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await startGoogleAuth(link);
      if (result.error || !result.url) {
        setError(result.error ?? "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง");
      } else {
        window.location.assign(result.url);
        return;
      }
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
    busy.current = false;
    setPending(false);
  }

  return (
    <div>
      <button type="button" onClick={begin} disabled={disabled || pending}
        className="w-full rounded-[11px] border px-4 py-3 text-[14px] font-medium cursor-pointer disabled:opacity-50"
        style={{ background: "var(--panel-2)", borderColor: "rgba(140,147,163,0.3)", color: "var(--white)" }}>
        {pending ? "กำลังเชื่อมต่อ…" : link ? "เชื่อมบัญชี Google" : "ดำเนินการต่อด้วย Google"}
      </button>
      {error && <p role="alert" className="mt-2 text-[13px]" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
