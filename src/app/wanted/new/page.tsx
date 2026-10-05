import type { CSSProperties } from "react";
import { requireVerifiedUserId } from "@/lib/session";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { WantedPostForm } from "../WantedPostForm";

export default async function NewWantedPostPage() {
  await requireVerifiedUserId();

  return (
    <div style={{ "--wrap-max": "680px" } as CSSProperties}>
      <BackHeader href="/profile" title="ลงประกาศหาการ์ด" />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          <h2 className="mb-3 text-[14px] font-medium" style={{ color: "var(--steel)" }}>
            คุณกำลังหาการ์ดอะไร
          </h2>
          <WantedPostForm submitLabel="เผยแพร่ประกาศหา" />
        </div>
      </main>
      <Footer note="เอกสารแนวคิดฉบับพรีวิว — ประกาศหาเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
