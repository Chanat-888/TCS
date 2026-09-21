import Link from "next/link";
import { getSessionUser } from "@/lib/session";

export async function PhoneVerificationNotice() {
  const user = await getSessionUser();
  if (!user || (user.phone && user.phone_confirmed_at)) return null;
  return (
    <aside className="wrap py-4 text-[13px]" style={{ color: "var(--steel)" }}>
      เลือกดูการ์ดได้เลย — ยืนยันเบอร์โทรก่อนประมูล ซื้อ หรือลงขาย{" "}
      <Link href="/verify-phone" className="font-medium" style={{ color: "var(--cyan)" }}>ยืนยันเบอร์โทร</Link>
    </aside>
  );
}
