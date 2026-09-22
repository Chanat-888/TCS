"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { getAccountDeletionBlockers, deleteMyAccount } from "@/app/profile/deleteAccountActions";

type Step = "idle" | "checking" | "blocked" | "confirming" | "deleting";

export function DeleteAccountButton() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [blockers, setBlockers] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const busy = useRef(false);

  async function start() {
    if (busy.current) return;
    busy.current = true;
    setStep("checking");
    setError("");
    try {
      const result = await getAccountDeletionBlockers();
      if ("error" in result) {
        setError(result.error);
        setStep("idle");
        return;
      }
      setWarnings(result.warnings);
      if (result.blockers.length > 0) {
        setBlockers(result.blockers);
        setStep("blocked");
        return;
      }
      setStep("confirming");
    } finally {
      busy.current = false;
    }
  }

  async function confirm() {
    if (busy.current) return;
    busy.current = true;
    setStep("deleting");
    setError("");
    try {
      const result = await deleteMyAccount();
      if ("error" in result) {
        setError(result.error);
        setBlockers(result.blockers ?? []);
        setStep(result.blockers?.length ? "blocked" : "confirming");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      busy.current = false;
    }
  }

  function reset() {
    setStep("idle");
    setError("");
    setBlockers([]);
    setWarnings([]);
  }

  if (step === "idle" || step === "checking") {
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={start}
          disabled={step === "checking"}
          className="border-0 bg-transparent p-0 text-[13px] cursor-pointer underline disabled:opacity-50"
          style={{ color: "var(--danger)" }}
        >
          {step === "checking" ? "กำลังตรวจสอบ…" : "ลบบัญชี"}
        </button>
        {error && <p role="alert" className="mt-2 text-[13px]" style={{ color: "var(--danger)" }}>{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 max-w-md rounded-2xl p-5" style={{ background: "var(--panel)", border: "1px solid rgba(232,102,79,0.3)" }}>
      {step === "blocked" ? (
        <>
          <h3 className="text-[14.5px] font-medium" style={{ color: "var(--danger)" }}>ลบบัญชีตอนนี้ไม่ได้</h3>
          <ul className="mt-[10px] flex flex-col gap-[6px] pl-[18px] text-[13px] leading-relaxed" style={{ color: "var(--steel)", listStyle: "disc" }}>
            {blockers.map((b) => <li key={b}>{b}</li>)}
          </ul>
          <button type="button" onClick={reset} className="mt-4 text-[13px] underline" style={{ color: "var(--steel)" }}>
            ปิด
          </button>
        </>
      ) : (
        <>
          <h3 className="text-[14.5px] font-medium" style={{ color: "var(--danger)" }}>ยืนยันการลบบัญชี</h3>
          <p className="mt-[8px] text-[13px] leading-relaxed" style={{ color: "var(--steel)" }}>
            บัญชีนี้จะเข้าสู่ระบบไม่ได้อีก ที่อยู่จัดส่งและรูปโปรไฟล์ที่อัปโหลดจะถูกลบถาวร
            ประวัติคำสั่งซื้อเก่าจะยังคงอยู่ แต่จะแสดงชื่อคุณเป็น &ldquo;ผู้ใช้ที่ถูกลบ&rdquo; การกระทำนี้ย้อนกลับไม่ได้
          </p>
          {warnings.length > 0 && (
            <ul className="mt-3 flex flex-col gap-[6px] rounded-xl p-3 pl-[26px] text-[12.5px] leading-relaxed" style={{ background: "rgba(232,184,79,0.08)", border: "1px solid rgba(232,184,79,0.3)", color: "var(--gold)", listStyle: "disc" }}>
              {warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
          {error && <p role="alert" className="mt-3 text-[13px]" style={{ color: "var(--danger)" }}>{error}</p>}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={reset}
              disabled={step === "deleting"}
              className="h-11 flex-1 cursor-pointer rounded-[10px] text-[13.5px] disabled:opacity-40"
              style={{ background: "transparent", border: "1px solid rgba(140,147,163,0.3)", color: "var(--steel)" }}
            >
              ยกเลิก
            </button>
            <div className="flex-1">
              <PrimaryButton type="button" height={44} variant="danger" loading={step === "deleting"} onClick={confirm}>
                ลบบัญชีถาวร
              </PrimaryButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
