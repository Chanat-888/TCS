/** Accept Thai mobile numbers in local, national-without-zero, or E.164 form. */
export function normalizeThaiPhone(input: unknown): string | null {
  if (typeof input !== "string" || !/^[+\d\s()-]+$/.test(input)) return null;
  let digits = input.replace(/[\s()-]/g, "");
  if (digits.startsWith("+66")) digits = digits.slice(3);
  else if (digits.startsWith("66") && digits.length === 11) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  return /^[689]\d{8}$/.test(digits) ? `+66${digits}` : null;
}
