import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";

export default async function MyProfileRedirect() {
  const userId = await getSessionUserId();
  redirect(userId ? `/profile/${userId}` : "/login");
}
