type ErrorLike = { code?: unknown; status?: unknown; message?: unknown };

/**
 * Server-side diagnostics for failed auth steps, so setup problems (SMS
 * provider, redirect URLs, missing profile rows) show their real cause in the
 * terminal / Vercel logs instead of one generic message for the user.
 * Never pass tokens, OTP codes or phone numbers; digits runs in provider
 * messages are redacted defensively.
 */
export function logAuthError(scope: string, error: unknown) {
  const e = (typeof error === "object" && error !== null ? error : { message: String(error) }) as ErrorLike;
  const message = typeof e.message === "string"
    ? e.message.replace(/\+?\d[\d\s-]{7,}\d/g, "[number]").slice(0, 300)
    : undefined;
  console.error(`[auth] ${scope}`, { code: e.code, status: e.status, message });
}
