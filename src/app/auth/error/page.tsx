import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="min-h-svh flex flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="text-2xl">เข้าสู่ระบบไม่สำเร็จ</h1>
      <p style={{ color: "var(--steel)" }}>
        คุณอาจยกเลิกการเชื่อมต่อ หรือลิงก์หมดอายุ กรุณาเริ่มใหม่อีกครั้ง
      </p>
      <p style={{ color: "var(--steel)" }}>
        หากบัญชี LINE หรือ Google นี้เชื่อมกับบัญชี TCS อื่นแล้ว กรุณาใช้บัญชีเดิมหรือติดต่อผู้ดูแล
      </p>
      <Link href="/login" style={{ color: "var(--cyan)" }}>กลับไปเข้าสู่ระบบ</Link>
      <Link href="/profile" style={{ color: "var(--cyan)" }}>กลับไปบัญชีของฉัน</Link>
    </main>
  );
}
