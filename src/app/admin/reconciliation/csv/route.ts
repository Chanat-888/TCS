import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";

// Accountant export for one month (?month=2026-10): ledger totals per kind, then closing balances per seller.
export async function GET(req: NextRequest) {
  if (!(await isAdmin(await getSessionUserId()))) return new NextResponse("Not found", { status: 404 });
  const month = req.nextUrl.searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return new NextResponse("month must look like 2026-10", { status: 400 });
  const { data, error } = await createServiceClient().rpc("monthly_export", { p_month: `${month}-01` });
  if (error) return new NextResponse("Export failed", { status: 500 });
  const rows = (data ?? []).map((r: { section: string; label: string; seller_id: string | null; amount: number }) =>
    [r.section, r.label, r.seller_id ?? "", (r.amount / 100).toFixed(2)].join(","),
  );
  const csv = ["section,label,seller_id,amount_thb", ...rows].join("\r\n");
  return new NextResponse(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="ledger-${month}.csv"`, "cache-control": "no-store" },
  });
}
