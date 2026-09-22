// Profile photos come from sign-in providers or our own upload, and the URL
// originates in metadata or storage the client can influence. Only https URLs
// on the providers' own photo hosts, or a file in our own avatars bucket, are
// ever rendered. Mirrors public.is_trusted_avatar_url() in migrations 0009 and
// 0011; keep the two in sync.
const TRUSTED_HOSTS = [/^lh[3-6][.]googleusercontent[.]com$/, /^s?profile[.]line-scdn[.]net$/];
export const AVATAR_STORAGE_PATH_PREFIX = "/storage/v1/object/public/avatars/";
const OWN_STORAGE_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return null;
  }
})();

export function trustedAvatarUrl(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 500 || /\s/.test(input)) return null;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (TRUSTED_HOSTS.some((host) => host.test(url.hostname))) return url.toString();
  if (OWN_STORAGE_HOST && url.hostname === OWN_STORAGE_HOST && url.pathname.startsWith(AVATAR_STORAGE_PATH_PREFIX)) return url.toString();
  return null;
}

// The photo a sign-in identity offers, if any. identity_data comes from the
// provider via Supabase Auth, but the client can still influence it, so the
// result always goes through the same trusted-host check as any other avatar.
export function avatarFromIdentity(identity: { identity_data?: Record<string, unknown> } | null | undefined): string | null {
  const data = identity?.identity_data;
  if (!data) return null;
  return trustedAvatarUrl(data.avatar_url) ?? trustedAvatarUrl(data.picture);
}
