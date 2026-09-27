import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { WelcomeDeck } from "./WelcomeDeck";

export const metadata: Metadata = { title: "ยินดีต้อนรับสู่ TCS" };

export default async function WelcomePage() {
  if (!(await getSessionUserId())) redirect("/login");
  return <WelcomeDeck />;
}
