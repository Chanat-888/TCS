// Courier public tracking pages. The courier is a free-text value from the seller's
// dropdown; an unknown courier or empty number yields null (no link shown).
const TRACKERS: Record<string, (n: string) => string> = {
  "Flash Express": (n) => `https://www.flashexpress.co.th/fle/tracking?se=${n}`,
  "Kerry Express": (n) => `https://th.kerryexpress.com/th/track/?track=${n}`,
  "ไปรษณีย์ไทย (EMS)": (n) => `https://track.thailandpost.co.th/?trackNumber=${n}`,
  "J&T Express": (n) => `https://www.jtexpress.co.th/service/track?billcode=${n}`,
};

export function trackingUrl(courier: string | null, trackingNumber: string | null) {
  const number = trackingNumber?.trim();
  const build = courier ? TRACKERS[courier] : undefined;
  return build && number ? build(encodeURIComponent(number)) : null;
}
