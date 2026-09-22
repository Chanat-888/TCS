import { getSessionUser } from "@/lib/session";
import { avatarFromIdentity } from "@/lib/avatar";
import { AvatarPicker } from "@/components/AvatarPicker";

type Option = { provider: "line" | "google"; url: string; label: string };

/** Private: render only after the caller has verified the session user is the
 * profile owner (ProfileView gates this on isOwner). Uploading is always
 * available; provider photos are offered too when a linked identity has one. */
export async function OwnerAvatarEditor({ avatarUrl, initial }: { avatarUrl: string | null; initial: string }) {
  const user = await getSessionUser();
  const options: Option[] = user
    ? [
        { provider: "line" as const, label: "ใช้รูปจาก LINE", url: avatarFromIdentity(user.identities?.find((i) => i.provider === "custom:line")) },
        { provider: "google" as const, label: "ใช้รูปจาก Google", url: avatarFromIdentity(user.identities?.find((i) => i.provider === "google")) },
      ].filter((o): o is Option => o.url !== null)
    : [];

  return <AvatarPicker avatarUrl={avatarUrl} initial={initial} options={options} />;
}
