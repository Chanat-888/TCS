/** Bump when the terms or privacy text changes; everyone is asked to accept again. Draft text: docs/terms-draft.md. */
export const TERMS_VERSION = "v0-draft";

/** A same-site path to come back to after accepting; anything else (another site, "//host") becomes the fallback. */
export function safeNext(next: unknown, fallback = "/browse"): string {
  return typeof next === "string" && /^\/(?![/\\])/.test(next) ? next : fallback;
}
