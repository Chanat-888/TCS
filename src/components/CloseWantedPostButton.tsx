"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeWantedPost } from "@/app/wanted/actions";

/** Takes a "looking for" post down. Two taps, so a stray tap doesn't close it. */
export function CloseWantedPostButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function close() {
    setError("");
    startTransition(async () => {
      const result = await closeWantedPost(postId);
      if ("error" in result) {
        setError(result.error ?? "ปิดประกาศไม่สำเร็จ");
        setConfirming(false);
        return;
      }
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex h-[38px] flex-1 items-center justify-center rounded-[10px] text-[12.5px]"
          style={{ background: "transparent", border: "1px solid var(--danger-line)", color: "var(--danger)" }}
        >
          ปิดประกาศ
        </button>
        {error && (
          <p role="alert" className="basis-full text-[11.5px]" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
      </>
    );
  }
  return (
    <div className="flex flex-1 gap-2">
      <button
        type="button"
        onClick={close}
        disabled={pending}
        className="flex h-[38px] flex-1 items-center justify-center rounded-[10px] text-[12.5px] font-semibold disabled:opacity-60"
        style={{ background: "var(--danger)", color: "var(--ink-on-danger)" }}
      >
        {pending ? "..." : "ยืนยันปิด"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="flex h-[38px] items-center justify-center rounded-[10px] px-3 text-[12.5px]"
        style={{ background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--steel)" }}
      >
        ยกเลิก
      </button>
    </div>
  );
}
