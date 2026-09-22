import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { OAuthButton } from "@/components/OAuthButton";

const PHONE_LOGIN = process.env.NEXT_PUBLIC_PHONE_LOGIN === "true";

export async function AccountSignInMethods() {
  const user = await getSessionUser();
  if (!user) return null;
  const googleLinked = user.identities?.some((identity) => identity.provider === "google");
  const phoneVerified = Boolean(user.phone && user.phone_confirmed_at);
  return (
    <section className="wrap py-6">
      <div className="max-w-md rounded-2xl p-5" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.2)" }}>
        <h2 className="text-lg mb-3">ช่องทางเข้าสู่ระบบ</h2>
        {PHONE_LOGIN && (
          <>
            <p className="text-[13px] mb-3" style={{ color: "var(--steel)" }}>
              {phoneVerified ? "ยืนยันเบอร์โทรแล้ว" : "ยืนยันเบอร์โทรเพื่อเพิ่มความน่าเชื่อถือของบัญชี"}
            </p>
            {!phoneVerified && <Link href="/verify-phone" className="block mb-4" style={{ color: "var(--cyan)" }}>ยืนยันเบอร์โทร</Link>}
          </>
        )}
        {googleLinked ? <p className="text-[13px]" style={{ color: "var(--cyan)" }}>เชื่อมบัญชี Google สำรองแล้ว</p> : <OAuthButton provider="google" link />}
        <p className="text-[12px] mt-3" style={{ color: "var(--steel)" }}>เชื่อม Google ไว้เป็นบัญชีสำรอง เผื่อเข้าสู่ระบบด้วย LINE ไม่ได้ ประกาศและประวัติจะอยู่ในบัญชีเดิม</p>
      </div>
    </section>
  );
}
