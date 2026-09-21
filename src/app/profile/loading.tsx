import Link from "next/link";

export default function ProfileLoading() {
  return (
    <main className="wrap py-7" aria-busy="true">
      <Link href="/browse" className="text-[13px]" style={{ color: "var(--cyan)" }}>กลับไปเลือกดูการ์ด</Link>
      <p role="status" className="mt-6 text-[14px]" style={{ color: "var(--steel)" }}>กำลังโหลดโปรไฟล์…</p>
      <div aria-hidden="true" className="mt-6 space-y-6 motion-safe:animate-pulse">
        <div className="rounded-2xl h-44" style={{ background: "var(--panel)" }} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl" style={{ background: "var(--panel)" }} />)}
        </div>
        <div className="h-40 rounded-2xl" style={{ background: "var(--panel)" }} />
      </div>
    </main>
  );
}
