// Profile photos come from sign-in providers, and the URL originates in
// metadata the client can influence. Only https URLs on the providers' own photo
// hosts are ever rendered. Mirrors public.is_trusted_avatar_url() in migration
// 0009; keep the two in sync.
const TRUSTED_HOSTS = [/^lh[3-6][.]googleusercontent[.]com$/, /^s?profile[.]line-scdn[.]net$/];

export function trustedAvatarUrl(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 500 || /\s/.test(input)) return null;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  return TRUSTED_HOSTS.some((host) => host.test(url.hostname)) ? url.toString() : null;
}
