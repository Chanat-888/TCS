import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { LoginForm } from "@/app/login/LoginForm";

export default async function VerifyPhonePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.phone && user.phone_confirmed_at) redirect("/browse");
  return (
    <div className="min-h-svh flex flex-col relative overflow-x-hidden">
      <Link href="/browse" className="relative z-10 px-6 pt-5" style={{ color: "var(--cyan)" }}>กลับไปเลือกดูการ์ด</Link>
      <LoginForm verifyPhone />
    </div>
  );
}
