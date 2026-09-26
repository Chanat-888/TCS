import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { requireVerifiedUserId } from "@/lib/session";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { CreateListingForm } from "./CreateListingForm";

export default async function NewListingPage() {
  const userId = await requireVerifiedUserId();
  if (!userId) redirect("/login");

  return (
    <div style={{ "--wrap-max": "680px" } as CSSProperties}>
      <BackHeader href="/profile" title="ลงประกาศขายการ์ด" />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          <Link
            href="/listings/new/spread"
            className="mb-5 flex items-center justify-between gap-3 rounded-2xl p-4 no-underline"
            style={{ background: "var(--panel)", border: "1px solid var(--cyan-line)" }}
          >
            <span>
              <span className="block text-[14.5px] font-medium" style={{ color: "var(--white)" }}>
                มีการ์ดหลายใบ? โพสต์รวมในรูปเดียว
              </span>
              <span className="mt-1 block text-[12.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
                ถ่ายรูปการ์ดที่วางกระจาย แล้วแตะปักหมุดที่การ์ดแต่ละใบ ผู้ซื้อเลือกเป็นใบ ๆ ได้เหมือนใน Shopee / Lazada
              </span>
            </span>
            <span aria-hidden="true" style={{ color: "var(--cyan)", fontSize: 20 }}>›</span>
          </Link>
          <CreateListingForm />
        </div>
      </main>
      <Footer note="เอกสารแนวคิดฉบับพรีวิว — การอัปโหลดรูปและเผยแพร่ประกาศเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
