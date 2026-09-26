import { syncCharge } from "@/lib/omise";

// Omise webhooks are unsigned, so the body is only a hint: syncCharge re-reads the
// charge from Omise before changing anything. A 500 makes Omise retry later.
export async function POST(request: Request) {
  const event = await request.json().catch(() => null);
  if (event?.key === "charge.complete" && typeof event.data?.id === "string") {
    try {
      await syncCharge(event.data.id);
    } catch (e) {
      console.error("[omise webhook]", (e as Error).message);
      return new Response(null, { status: 500 });
    }
  }
  return new Response(null, { status: 200 });
}
