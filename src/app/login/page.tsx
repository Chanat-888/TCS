import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const userId = await getSessionUserId();
  if (userId) redirect("/browse");

  return (
    <div className="min-h-svh flex flex-col relative overflow-x-hidden">
      <LoginForm />
    </div>
  );
}
