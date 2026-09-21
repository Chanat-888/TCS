import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { requirePhoneVerifiedUserId } from "@/lib/session";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { CreateListingForm } from "./CreateListingForm";

export default async function NewListingPage() {
  const userId = await requirePhoneVerifiedUserId();
  if (!userId) redirect("/login");

  return (
    <div style={{ "--wrap-max": "680px" } as CSSProperties}>
      <BackHeader href="/profile" title="ลงประกาศขายการ์ด" />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          <CreateListingForm />
        </div>
      </main>
      <Footer note="เอกสารแนวคิดฉบับพรีวิว — การอัปโหลดรูปและเผยแพร่ประกาศเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
