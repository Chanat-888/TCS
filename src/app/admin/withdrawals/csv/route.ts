import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/secretBox";

// A cell starting with = + - @ would run as a formula in Excel; a leading quote stops that.
const cell = (v: string | number) => {
  const text = /^[=+\-@]/.test(String(v)) ? `'${v}` : String(v);
  return `"${text.replace(/"/g, '""')}"`;
};

export async function GET() {
  if (!(await isAdmin(await getSessionUserId()))) return new NextResponse("Not found", { status: 404 });
  const { data } = await createServiceClient()
    .from("withdrawals")
    .select("id, amount, fee, bank_brand, account_number_enc, account_name, created_at")
    .eq("status", "requested")
    .order("created_at");
  const rows = (data ?? []).map((w) =>
    [w.id, w.bank_brand, decrypt(w.account_number_enc), w.account_name, ((w.amount - w.fee) / 100).toFixed(2), w.created_at].map(cell).join(","),
  );
  const csv = ["withdrawal_id,bank,account_number,account_name,amount_thb,requested_at", ...rows].join("\r\n");
  return new NextResponse(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="withdrawals.csv"', "cache-control": "no-store" },
  });
}
