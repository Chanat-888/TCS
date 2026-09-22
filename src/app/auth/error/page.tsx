import Link from "next/link";

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const noAccount = reason === "no_account";
  return (
    <main className="min-h-svh flex flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="text-2xl">เข้าสู่ระบบไม่สำเร็จ</h1>
      {noAccount ? (
        <p style={{ color: "var(--steel)" }}>
          ไม่พบบัญชีที่เชื่อมกับ Google นี้ — Google ใช้เข้าสู่ระบบได้เฉพาะบัญชีที่เชื่อม LINE ไว้แล้วเท่านั้น
          กรุณาเข้าสู่ระบบด้วย LINE ก่อน หรือติดต่อผู้ดูแลหากหาบัญชีเดิมไม่เจอ
        </p>
      ) : (
        <>
          <p style={{ color: "var(--steel)" }}>
            คุณอาจยกเลิกการเชื่อมต่อ หรือลิงก์หมดอายุ กรุณาเริ่มใหม่อีกครั้ง
          </p>
          <p style={{ color: "var(--steel)" }}>
            หากบัญชี LINE หรือ Google นี้เชื่อมกับบัญชี TCS อื่นแล้ว กรุณาใช้บัญชีเดิมหรือติดต่อผู้ดูแล
          </p>
        </>
      )}
      <Link href="/login" style={{ color: "var(--cyan)" }}>กลับไปเข้าสู่ระบบ</Link>
      <Link href="/profile" style={{ color: "var(--cyan)" }}>กลับไปบัญชีของฉัน</Link>
    </main>
  );
}
