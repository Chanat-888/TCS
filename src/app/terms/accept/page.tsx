import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { BackHeader } from "@/components/BackHeader";
import { getSessionUserId } from "@/lib/session";
import { hasAcceptedTerms } from "@/lib/terms";
import { safeNext } from "@/lib/termsConfig";
import { AcceptForm } from "./AcceptForm";

export default async function AcceptTermsPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const next = safeNext((await searchParams).next);
  if (await hasAcceptedTerms(userId)) redirect(next);

  return (
    <div style={{ "--wrap-max": "560px" } as CSSProperties}>
      <BackHeader href="/browse" title="ข้อกำหนดการใช้งาน" />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          <p className="text-[14px] leading-[1.7]" style={{ color: "var(--steel)" }}>
            ก่อนลงขาย ถอนเงิน หรือชำระเงิน เราขอให้คุณยอมรับข้อกำหนด เพราะ TCS ถือเงินแทนผู้ขายและตัดสินข้อพิพาทตามกติกานี้
          </p>
          <AcceptForm next={next} />
        </div>
      </main>
    </div>
  );
}
