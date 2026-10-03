// Couriers, how to recognise their tracking numbers, and where each one's public tracking
// page lives. The seller only types the number: the courier is read from its format.
// To support a new courier (or fix a pattern), edit this one table.
//
// Patterns are matched against the number with spaces removed and upper-cased. Keep them
// specific enough that no two couriers match the same number.
export interface Courier {
  name: string;
  pattern: RegExp;
  url: (encodedNumber: string) => string;
}

export const COURIERS: Courier[] = [
  // Flash: "TH" then 10-13 letters/digits, e.g. TH012345678A0.
  { name: "Flash Express", pattern: /^TH[0-9A-Z]{10,13}$/, url: (n) => `https://www.flashexpress.co.th/fle/tracking?se=${n}` },
  // Kerry: "KEX" (or older "KER") then digits/letters.
  { name: "Kerry Express", pattern: /^(KEX|KER)[0-9A-Z]{6,14}$/, url: (n) => `https://th.kerryexpress.com/th/track/?track=${n}` },
  // Thailand Post (EMS/registered): two service letters, nine digits, then the country code "TH".
  { name: "ไปรษณีย์ไทย (EMS)", pattern: /^[A-Z]{2}[0-9]{9}TH$/, url: (n) => `https://track.thailandpost.co.th/?trackNumber=${n}` },
  // J&T Express: starts with "JT".
  { name: "J&T Express", pattern: /^JT[0-9A-Z]{8,14}$/, url: (n) => `https://www.jtexpress.co.th/service/track?billcode=${n}` },
];

export const COURIER_NAMES = COURIERS.map((c) => c.name);

/** Spaces removed, upper-case: how a tracking number is stored and matched. */
export function normalizeTrackingNumber(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** A waybill is letters, digits and the odd dash; anything else is a typo. Returns null if invalid. */
export function cleanTrackingNumber(raw: string): string | null {
  const value = normalizeTrackingNumber(raw);
  return /^[A-Z0-9-]{5,40}$/.test(value) ? value : null;
}

/** The courier a tracking number belongs to, judged by its format, or null if none match. */
export function detectCourier(raw: string): string | null {
  const value = normalizeTrackingNumber(raw);
  return COURIERS.find((c) => c.pattern.test(value))?.name ?? null;
}

export function trackingUrl(courier: string | null, trackingNumber: string | null) {
  const number = trackingNumber?.trim();
  const build = courier ? COURIERS.find((c) => c.name === courier)?.url : undefined;
  return build && number ? build(encodeURIComponent(number)) : null;
}
