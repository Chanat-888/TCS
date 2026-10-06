import "server-only";
import QRCode from "qrcode";
import { promptPayPayload } from "@/lib/promptpay";

/** The QR image (a data URL) for an order amount, paid into the company PromptPay ID in PROMPTPAY_ID. Null if the ID is not set up. */
export async function paymentQr(amountBaht: number): Promise<string | null> {
  const payload = promptPayPayload(process.env.PROMPTPAY_ID ?? "", amountBaht);
  return payload ? QRCode.toDataURL(payload, { margin: 2, width: 520 }) : null;
}
