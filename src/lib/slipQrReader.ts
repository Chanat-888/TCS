import { loadImage } from "@/lib/loadImage";

const MAX_SIDE = 2400;

/** Browser only: looks for a QR code in the slip picture and returns its text, or null. A hint, never trusted by the server. */
export async function readSlipQr(file: File): Promise<string | null> {
  try {
    const image = await loadImage(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      image.close();
      return null;
    }
    context.drawImage(image.source, 0, 0, width, height);
    image.close();
    const { default: jsQR } = await import("jsqr");
    return jsQR(context.getImageData(0, 0, width, height).data, width, height)?.data ?? null;
  } catch {
    return null;
  }
}
