import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CartView } from "./CartView";

export default async function CartPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  return (
    <div style={{ "--wrap-max": "1180px", "--wrap-pad": "24px", "--wrap-pad-sm": "16px" } as CSSProperties}>
      <SiteHeader userId={userId} />
      <main>
        <CartView />
      </main>
      <Footer note="ตะกร้าเก็บไว้ในเบราว์เซอร์นี้เท่านั้น ยังไม่เชื่อมระบบชำระเงินจริง" />
    </div>
  );
}
