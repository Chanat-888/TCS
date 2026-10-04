import type { CSSProperties } from "react";
import { requireVerifiedUserId } from "@/lib/session";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { createWantedPost } from "../actions";
import { WantedPostForm } from "../WantedPostForm";

export default async function NewWantedPostPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireVerifiedUserId();
  const { error } = await searchParams;

  return (
    <div style={{ "--wrap-max": "680px" } as CSSProperties}>
      <BackHeader href="/profile" title="ลงประกาศหาการ์ด" />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          <h2 className="mb-3 text-[14px] font-medium" style={{ color: "var(--steel)" }}>
            คุณกำลังหาการ์ดอะไร
          </h2>
          <WantedPostForm action={createWantedPost} submitLabel="เผยแพร่ประกาศหา" error={Boolean(error)} />
        </div>
      </main>
      <Footer note="เอกสารแนวคิดฉบับพรีวิว — ประกาศหาเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
