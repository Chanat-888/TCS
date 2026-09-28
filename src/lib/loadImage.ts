/** A decoded picture that can be drawn onto a canvas, plus a way to release it. */
export interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

// Some browsers don't reject a createImageBitmap() call that fails on a particular
// GIF/WebP file — the promise just never settles. A try/catch alone can't recover
// from that (there's nothing to catch), so the wait is capped and treated the same
// as a failure: fall back to <img> rather than leaving the seller stuck forever.
const DECODE_TIMEOUT_MS = 6000;

function decodeWithImgElement(file: Blob): Promise<LoadedImage> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  return img.decode().then(
    () => ({ source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) }),
    (error) => {
      URL.revokeObjectURL(url);
      throw error;
    }
  );
}

/**
 * Decodes an image file for drawing. `createImageBitmap` is the fast path (and applies the
 * photo's own rotation flag), but it is missing, fails, or on some browsers simply hangs on
 * certain files, so fall back to a plain <img> element rather than leaving the seller with a
 * photo they cannot adjust.
 */
export async function loadImage(file: Blob, timeoutMs: number = DECODE_TIMEOUT_MS): Promise<LoadedImage> {
  let gaveUp = false;
  const bitmapPromise = (async () => {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  })();
  // If the bitmap resolves after we've already fallen back to <img> (a late,
  // successful decode past the timeout), close it rather than leak it — nothing
  // will ever use it.
  bitmapPromise.then((image) => { if (gaveUp) image.close(); }, () => {});

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("image decode timed out")), timeoutMs);
  });

  try {
    return await Promise.race([bitmapPromise, timeout]);
  } catch {
    gaveUp = true;
    return decodeWithImgElement(file);
  }
}
