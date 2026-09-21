import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { loadProfileData } from "@/lib/profile";
import { ProfileView } from "../ProfileView";

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Public profile data does not depend on the viewer, so it loads while the
  // session is verified instead of after it. The no-op catch only prevents an
  // unhandled rejection if we redirect first; ProfileView still awaits it.
  const data = loadProfileData(id);
  data.catch(() => {});
  const viewerId = await getSessionUserId();
  if (!viewerId) redirect("/login");
  return <ProfileView id={id} viewerId={viewerId} data={data} />;
}
