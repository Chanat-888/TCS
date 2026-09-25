import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { OAuthButton } from "@/components/OAuthButton";
import { UnlinkGoogleButton } from "@/components/UnlinkGoogleButton";

const PHONE_LOGIN = process.env.NEXT_PUBLIC_PHONE_LOGIN === "true";

const googleMark = (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const phoneMark = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
    <rect x="5.5" y="2.5" width="9" height="15" rx="2" />
    <path d="M9 14.5 H11" />
  </svg>
);

function LinkedPill() {
  return (
    <span
      className="inline-flex flex-shrink-0 items-center gap-[6px] rounded-full px-3 py-[5px] text-[12.5px] font-medium"
      style={{ background: "var(--cyan-tint)", border: "1px solid var(--cyan-line)", color: "var(--cyan)" }}
    >
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M5.5 10.4 L8.6 13.4 L14.5 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      เชื่อมแล้ว
    </span>
  );
}

function Method({ mark, name, note, action }: { mark: React.ReactNode; name: string; note: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span className="flex flex-shrink-0 items-center justify-center rounded-[10px]" style={{ width: 40, height: 40, background: "var(--panel-2)", border: "1px solid var(--line-soft)", color: "var(--steel)" }}>
        {mark}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-medium" style={{ color: "var(--white)" }}>{name}</p>
        <p className="text-[12.5px]" style={{ color: "var(--steel)" }}>{note}</p>
      </div>
      {action}
    </div>
  );
}

export async function AccountSignInMethods() {
  const user = await getSessionUser();
  if (!user) return null;
  const googleLinked = user.identities?.some((identity) => identity.provider === "google");
  const phoneVerified = Boolean(user.phone && user.phone_confirmed_at);
  const canUnlink = googleLinked && (user.identities?.length ?? 0) > 1;
  return (
    <section className="wrap py-6">
      <div className="max-w-md overflow-hidden rounded-2xl" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
        <div className="px-5 pb-4 pt-5">
          <h2 className="text-[1.15rem]">ช่องทางเข้าสู่ระบบ</h2>
          <p className="mt-1 max-w-[46ch] text-[12.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
            เชื่อม Google ไว้เป็นบัญชีสำรอง เผื่อเข้าสู่ระบบด้วย LINE ไม่ได้ ประกาศและประวัติจะอยู่ในบัญชีเดิม
          </p>
        </div>
        <div className="flex flex-col" style={{ borderTop: "1px solid var(--line-soft)" }}>
          {PHONE_LOGIN && (
            <Method
              mark={phoneMark}
              name="เบอร์โทร"
              note={phoneVerified ? "ยืนยันเบอร์โทรแล้ว" : "ยืนยันเพื่อเพิ่มความน่าเชื่อถือของบัญชี"}
              action={
                phoneVerified ? (
                  <LinkedPill />
                ) : (
                  <Link
                    href="/verify-phone"
                    className="inline-flex min-h-11 flex-shrink-0 items-center rounded-full px-5 text-[13.5px] font-medium no-underline transition-colors hover:border-[var(--cyan-line)]"
                    style={{ background: "var(--panel-2)", border: "1px solid var(--line-strong)", color: "var(--cyan)" }}
                  >
                    ยืนยัน
                  </Link>
                )
              }
            />
          )}
          {PHONE_LOGIN && <div style={{ borderTop: "1px solid var(--line-soft)" }} />}
          <Method
            mark={googleMark}
            name="Google"
            note="บัญชีสำรอง"
            action={googleLinked ? <LinkedPill /> : <OAuthButton provider="google" link compact />}
          />
          {canUnlink && (
            <div className="px-5 pb-4 pl-[72px]">
              <UnlinkGoogleButton />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
