import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { getSessionUserId } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/secretBox";
import { BANKS } from "@/lib/bankAccount";
import { formatRelativeTime } from "@/lib/format";
import { formatSatang } from "@/lib/money";
import { WithdrawalActions } from "./WithdrawalActions";

const card: CSSProperties = { background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" };

export default async function AdminWithdrawalsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  if (!(await isAdmin(userId))) notFound();

  const supabase = createServiceClient();
  const [{ data: open }, { data: done }, { data: balances }] = await Promise.all([
    supabase.from("withdrawals").select("*, seller:profiles(display_name)").eq("status", "requested").order("created_at"),
    supabase
      .from("withdrawals")
      .select("id, amount, fee, status, bank_reference, decided_at, seller:profiles(display_name)")
      .neq("status", "requested")
      .order("decided_at", { ascending: false })
      .limit(20),
    supabase.from("seller_balances").select("bucket, total"),
  ]);
  // What TCS owes all sellers: the cash that must still be in the holding account (plan section 12).
  const owed = (balances ?? []).filter((b) => b.bucket !== "commission").reduce((sum, b) => sum + Number(b.total), 0);
  const name = (row: { seller: unknown }) => (row.seller as { display_name: string } | null)?.display_name ?? "—";

  return (
    <div style={{ "--wrap-max": "980px" } as CSSProperties}>
      <BackHeader href="/admin" title="คำขอถอนเงิน" />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          <div className="rounded-2xl p-5" style={card}>
            <div className="mono text-[22px]" style={{ color: "var(--white)" }}>{formatSatang(owed)}</div>
            <div className="mt-1 text-[12.5px]" style={{ color: "var(--steel)" }}>
              ยอดที่ต้องจ่ายผู้ขายทั้งหมด (รอ + ถอนได้) เงินในบัญชี B ต้องไม่น้อยกว่านี้
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between">
            <h2 className="text-[1.1rem]">รอโอน ({open?.length ?? 0})</h2>
            {(open?.length ?? 0) > 0 && <a href="/admin/withdrawals/csv" className="text-[13px]" style={{ color: "var(--cyan)" }}>ดาวน์โหลด CSV</a>}
          </div>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--steel)" }}>
            ก่อนโอนครั้งแรก ตรวจว่าชื่อบัญชีที่แอปธนาคารแสดงตรงกับชื่อผู้ขาย
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {(open ?? []).map((w) => (
              <div key={w.id} className="flex flex-col gap-3 rounded-2xl p-4" style={card}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[14px] font-medium">{name(w)}</span>
                  <span className="mono text-[16px]">
                    โอน {formatSatang(w.amount - w.fee)} <span className="text-[12px]" style={{ color: "var(--steel)" }}>(ค่าถอน {formatSatang(w.fee)})</span>
                  </span>
                </div>
                <div className="mono text-[13px]" style={{ color: "var(--steel)" }}>
                  {BANKS[w.bank_brand] ?? w.bank_brand} · {decrypt(w.account_number_enc)} · {w.account_name} · {formatRelativeTime(w.created_at)}
                </div>
                <WithdrawalActions id={w.id} />
              </div>
            ))}
            {(open ?? []).length === 0 && <p className="text-[13.5px]" style={{ color: "var(--steel)" }}>ไม่มีคำขอที่รอโอน</p>}
          </div>

          <h2 className="mt-8 mb-3 text-[1.1rem]">ล่าสุด</h2>
          <div className="flex flex-col gap-2">
            {(done ?? []).map((w) => (
              <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-[13.5px]" style={card}>
                <span>{name(w)} · <span className="mono">{formatSatang(w.amount - w.fee)}</span></span>
                <span style={{ color: w.status === "paid" ? "var(--good)" : "var(--danger)" }}>
                  {w.status === "paid" ? "โอนแล้ว" : "ไม่สำเร็จ"}{w.bank_reference ? ` · ${w.bank_reference}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer note="เครื่องมือแอดมิน — ผู้ดูแลโอนเงินด้วยมือจากแอปธนาคาร" />
    </div>
  );
}
