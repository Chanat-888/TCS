import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runAllTimers } from "@/lib/orderTimers";

// A busy minute can touch a few hundred rows; allow more than the default limit.
export const maxDuration = 60;

// Called every minute by Supabase's own scheduler (see docs/timers-setup.md), never
// by a browser: it needs the shared secret, and it is closed (503) when none is set.
function authorized(request: Request, secret: string) {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "timers not configured" }, { status: 503 });
  if (!authorized(request, secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const results = await runAllTimers(createServiceClient());
  return NextResponse.json({ ok: true, results });
}
