"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { acceptTerms } from "./actions";

export function AcceptForm({ next }: { next: string }) {
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    const result = await acceptTerms(next); // redirects on success
    setBusy(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="mt-5 flex flex-col gap-4">
      <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-[1.6]">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 h-4 w-4 shrink-0" />
        <span>
          ฉันได้อ่านและยอมรับ{" "}
          <a href="/terms" target="_blank" style={{ color: "var(--cyan)" }}>ข้อกำหนดการใช้งาน</a> และ{" "}
          <a href="/privacy" target="_blank" style={{ color: "var(--cyan)" }}>นโยบายความเป็นส่วนตัว</a>
        </span>
      </label>
      <PrimaryButton type="button" disabled={!checked} loading={busy} onClick={submit}>
        ยอมรับและดำเนินการต่อ
      </PrimaryButton>
      {error && <p role="alert" className="text-[13px]" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
