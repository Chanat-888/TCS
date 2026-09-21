import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { loadProfileData } from "@/lib/profile";
import { ProfileView } from "./ProfileView";

export default async function MyProfilePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  return <ProfileView id={userId} viewerId={userId} data={loadProfileData(userId)} />;
}
