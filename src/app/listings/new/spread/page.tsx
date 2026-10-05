import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { requireVerifiedUserId } from "@/lib/session";
import { requireTerms } from "@/lib/terms";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { SpreadEditor } from "./SpreadEditor";

export default async function NewSpreadPostPage() {
  const userId = await requireVerifiedUserId();
  if (!userId) redirect("/login");
  await requireTerms(userId, "/listings/new/spread");

  return (
    <div style={{ "--wrap-max": "760px" } as CSSProperties}>
      <BackHeader href="/listings/new" title="โพสต์การ์ดหลายใบในรูปเดียว" />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          <SpreadEditor />
        </div>
      </main>
      <Footer note="เอกสารแนวคิดฉบับพรีวิว — การอัปโหลดรูปและเผยแพร่โพสต์เชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
