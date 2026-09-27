/** A decoded picture that can be drawn onto a canvas, plus a way to release it. */
export interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

/**
 * Decodes an image file for drawing. `createImageBitmap` is the fast path (and applies the
 * photo's own rotation flag), but it is missing or fails on some browsers, so fall back to
 * a plain <img> element rather than leaving the seller with a photo they cannot adjust.
 */
export async function loadImage(file: Blob): Promise<LoadedImage> {
  try {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }
}
