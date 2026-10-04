import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { formatRelativeTime } from "@/lib/format";
import { formatSatang } from "@/lib/money";
import { WithdrawForm } from "./WithdrawForm";

const ENTRY_LABEL: Record<string, string> = {
  order_paid: "ผู้ซื้อชำระเงินแล้ว (รอรับสินค้า)",
  order_completed: "คำสั่งซื้อเสร็จสิ้น",
  order_reversed: "คืนเงินผู้ซื้อ",
  withdrawal: "ขอถอนเงิน",
  withdrawal_failed: "ถอนไม่สำเร็จ เงินคืนเข้ายอดที่ถอนได้",
};
const WITHDRAWAL_LABEL: Record<string, string> = { requested: "รอโอน", paid: "โอนแล้ว", failed: "ไม่สำเร็จ" };

const card: CSSProperties = { background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" };

export default async function EarningsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const supabase = createServiceClient();

  const [{ data: balances }, { data: entries }, { data: withdrawals }, { data: account }] = await Promise.all([
    supabase.from("seller_balances").select("bucket, total").eq("seller_id", userId).in("bucket", ["pending", "available"]),
    // A completed order writes two entries (pending out, available in); the "available in" one is the one to show.
    supabase
      .from("ledger_entries")
      .select("id, kind, bucket, amount, created_at, order:orders(order_code)")
      .eq("seller_id", userId)
      .in("bucket", ["pending", "available"])
      .not("key", "like", "%-pending-out")
      .order("id", { ascending: false })
      .limit(30),
    supabase.from("withdrawals").select("id, amount, fee, status, created_at, bank_reference").eq("seller_id", userId).order("created_at", { ascending: false }).limit(20),
    supabase.from("seller_payout_accounts").select("bank_brand").eq("user_id", userId).not("account_number_enc", "is", null).maybeSingle(),
  ]);
  const total = (bucket: string) => Number(balances?.find((b) => b.bucket === bucket)?.total ?? 0);
  const available = total("available");

  return (
    <div style={{ "--wrap-max": "820px", "--wrap-pad": "24px", "--wrap-pad-sm": "16px" } as CSSProperties}>
      <SiteHeader userId={userId} />
      <main className="wrap py-8">
        <h1 className="text-[clamp(1.4rem,3vw,1.75rem)]">รายได้ของฉัน</h1>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-5" style={card}>
            <div className="mono text-[22px]" style={{ color: "var(--white)" }}>{formatSatang(available)}</div>
            <div className="mt-1 text-[12.5px]" style={{ color: "var(--steel)" }}>ถอนได้ตอนนี้</div>
          </div>
          <div className="rounded-2xl p-5" style={card}>
            <div className="mono text-[22px]" style={{ color: "var(--white)" }}>{formatSatang(total("pending"))}</div>
            <div className="mt-1 text-[12.5px]" style={{ color: "var(--steel)" }}>รอผู้ซื้อรับสินค้า</div>
          </div>
        </div>

        <section className="mt-6 rounded-2xl p-5" style={card}>
          <h2 className="text-[1.1rem]">ถอนเงิน</h2>
          {account ? (
            <WithdrawForm availableBaht={Math.floor(available / 100)} />
          ) : (
            <p className="mt-2 text-[13.5px]" style={{ color: "var(--steel)" }}>
              เพิ่มบัญชีรับเงินที่ <Link href="/profile" style={{ color: "var(--cyan)" }}>หน้าโปรไฟล์</Link> ก่อนจึงจะถอนได้
            </p>
          )}
        </section>

        <h2 className="mt-8 mb-3 text-[1.1rem]">คำขอถอนเงิน</h2>
        {(withdrawals ?? []).length === 0 ? (
          <p className="text-[13.5px]" style={{ color: "var(--steel)" }}>ยังไม่มีคำขอถอนเงิน</p>
        ) : (
          <div className="flex flex-col gap-2">
            {withdrawals!.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-[13.5px]" style={card}>
                <span className="mono">
                  {formatSatang(w.amount - w.fee)} <span style={{ color: "var(--steel)" }}>(ถอน {formatSatang(w.amount)} − ค่าถอน {formatSatang(w.fee)})</span>
                </span>
                <span style={{ color: "var(--steel)" }}>
                  {WITHDRAWAL_LABEL[w.status]}{w.bank_reference ? ` · อ้างอิง ${w.bank_reference}` : ""} · {formatRelativeTime(w.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}

        <h2 className="mt-8 mb-3 text-[1.1rem]">ประวัติ</h2>
        {(entries ?? []).length === 0 ? (
          <p className="text-[13.5px]" style={{ color: "var(--steel)" }}>ยังไม่มีรายการ</p>
        ) : (
          <div className="flex flex-col gap-2">
            {entries!.map((e) => {
              const order = e.order as unknown as { order_code: string } | null;
              return (
                <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-[13.5px]" style={card}>
                  <span>
                    {ENTRY_LABEL[e.kind] ?? e.kind}
                    {order ? <span className="mono" style={{ color: "var(--steel)" }}> · #{order.order_code}</span> : null}
                  </span>
                  <span className="mono" style={{ color: e.amount < 0 ? "var(--steel)" : "var(--white)" }}>
                    {e.amount < 0 ? "−" : "+"}{formatSatang(Math.abs(e.amount))}{" "}
                    <span style={{ color: "var(--steel)" }}>({e.bucket === "pending" ? "รอ" : "ถอนได้"})</span>
                    <span style={{ color: "var(--steel-dim)" }}> · {formatRelativeTime(e.created_at)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer note="ยอดทั้งหมดคำนวณจากบัญชีแยกประเภทที่แก้ไขย้อนหลังไม่ได้" />
    </div>
  );
}
