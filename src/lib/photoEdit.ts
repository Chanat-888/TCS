/**
 * Geometry for rotating and cropping a photo. Rectangles are normalised to the
 * photo (0..1); pins are stored as a percentage (0..100) of the photo's width and
 * height. When a photo is rotated or cropped, the pins on it must follow their cards.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Smallest crop the seller can make, as a fraction of the photo's width/height. */
export const MIN_CROP = 0.1;

export const FULL_RECT: Rect = { x: 0, y: 0, w: 1, h: 1 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** A crop rectangle after the photo is turned 90° clockwise. */
export function rotateRectCw(r: Rect): Rect {
  return { x: 1 - r.y - r.h, y: r.x, w: r.h, h: r.w };
}

/** A crop rectangle after the photo is turned 90° anti-clockwise. */
export function rotateRectCcw(r: Rect): Rect {
  return { x: r.y, y: 1 - r.x - r.w, w: r.h, h: r.w };
}

/** Keeps a crop inside the photo and no smaller than MIN_CROP. */
export function clampRect(r: Rect): Rect {
  const w = clamp(r.w, MIN_CROP, 1);
  const h = clamp(r.h, MIN_CROP, 1);
  return { x: clamp(r.x, 0, 1 - w), y: clamp(r.y, 0, 1 - h), w, h };
}

export interface PinPoint {
  x: number;
  y: number;
}

export interface MovedPin extends PinPoint {
  /** False when the pin's card is outside the cropped area, so the pin no longer belongs on the photo. */
  kept: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Moves pins (x, y as % of the photo) to where their cards end up after `turns`
 * clockwise quarter turns followed by cropping to `crop` (a rectangle of the rotated photo).
 */
export function transformPins(pins: PinPoint[], turns: number, crop: Rect): MovedPin[] {
  const quarterTurns = ((Math.round(turns) % 4) + 4) % 4;
  return pins.map((pin) => {
    let x = pin.x / 100;
    let y = pin.y / 100;
    for (let i = 0; i < quarterTurns; i++) [x, y] = [1 - y, x];
    const nx = (x - crop.x) / crop.w;
    const ny = (y - crop.y) / crop.h;
    const kept = nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1;
    return { x: round1(clamp(nx, 0, 1) * 100), y: round1(clamp(ny, 0, 1) * 100), kept };
  });
}
