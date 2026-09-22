import Link from "next/link";
import { getSessionUser } from "@/lib/session";

// Phone verification is optional and only offered while SMS login is enabled.
const PHONE_LOGIN = process.env.NEXT_PUBLIC_PHONE_LOGIN === "true";

export async function PhoneVerificationNotice() {
  if (!PHONE_LOGIN) return null;
  const user = await getSessionUser();
  if (!user || (user.phone && user.phone_confirmed_at)) return null;
  return (
    <aside className="wrap py-4 text-[13px]" style={{ color: "var(--steel)" }}>
      ยืนยันเบอร์โทรเพื่อเพิ่มความน่าเชื่อถือของบัญชี{" "}
      <Link href="/verify-phone" className="font-medium" style={{ color: "var(--cyan)" }}>ยืนยันเบอร์โทร</Link>
    </aside>
  );
}
