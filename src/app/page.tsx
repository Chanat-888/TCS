import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";

export default async function RootPage() {
  const userId = await getSessionUserId();
  redirect(userId ? "/browse" : "/login");
}
