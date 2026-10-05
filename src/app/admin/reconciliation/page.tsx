import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import { BackHeader } from "@/components/BackHeader";
import { Footer } from "@/components/Footer";
import { getSessionUserId } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { formatRelativeTime } from "@/lib/format";
import { formatSatang } from "@/lib/money";
import { BalanceForm, MatchForm } from "./Forms";

const card: CSSProperties = { background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" };

export default async function AdminReconciliationPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  if (!(await isAdmin(userId))) notFound();

  const supabase = createServiceClient();
  const [{ data: owedData }, { data: logs }, { data: unmatched }] = await Promise.all([
    supabase.rpc("total_owed"),
    supabase.from("reconciliation_log").select("id, b_balance, owed, difference, created_at").order("id", { ascending: false }).limit(14),
    supabase
      .from("orders")
      .select("id, order_code, amount, status, seller:profiles!seller_id(display_name)")
      .is("bank_matched_at", null)
      .not("commission_bps", "is", null)
      .not("status", "in", "(PENDING_PAYMENT,REFUNDED,CANCELLED)")
      .order("created_at")
      .limit(100),
  ]);
  const owed = Number(owedData ?? 0);
  const latest = logs?.[0];
  // The latest typed balance against what is owed now: orders or withdrawals since then can open a gap.
  const shortfall = latest ? owed - Number(latest.b_balance) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const stale = !latest || latest.created_at.slice(0, 10) !== today;
  const month = today.slice(0, 7);

  return (
    <div style={{ "--wrap-max": "980px" } as CSSProperties}>
      <BackHeader href="/admin" title="ตรวจยอดบัญชี B" />
      <main className="py-7 pb-[70px]">
        <div className="wrap">
          {shortfall > 0 && (
            <div role="alert" className="mb-4 rounded-2xl p-4 text-[13.5px]" style={{ ...card, color: "var(--danger)" }}>
              เงินในบัญชี B (ตามที่บันทึกล่าสุด) น้อยกว่ายอดที่ต้องจ่ายผู้ขาย {formatSatang(shortfall)} — ตรวจบัญชีทันที
            </div>
          )}
          <div className="rounded-2xl p-5" style={card}>
            <div className="mono text-[22px]" style={{ color: "var(--white)" }}>{formatSatang(owed)}</div>
            <div className="mt-1 text-[12.5px]" style={{ color: "var(--steel)" }}>
              ยอดที่ต้องจ่ายผู้ขายทั้งหมดตอนนี้ (รอ + ถอนได้ + คำขอถอนที่ยังไม่โอน)
            </div>
            {stale && <p className="mt-3 text-[12.5px]" style={{ color: "var(--danger)" }}>ยังไม่ได้ตรวจยอดวันนี้</p>}
            <div className="mt-4"><BalanceForm /></div>
          </div>

          <div className="mt-8 mb-1"><h2 className="text-[1.1rem]">ประวัติการตรวจ</h2></div>
          <p className="mb-3 text-[12.5px]" style={{ color: "var(--steel)" }}>
            ส่วนต่างบวก = เงินใน B ที่ไม่ใช่ของผู้ขาย (ค่าคอมมิชชันของเรา หรือเงินโอนเข้าที่ยังไม่ทราบที่มา) ส่วนต่างลบ = เงินไม่พอจ่ายผู้ขาย
          </p>
          <div className="flex flex-col gap-2">
            {(logs ?? []).map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-[13.5px]" style={card}>
                <span className="mono">B {formatSatang(Number(l.b_balance))} · ต้องจ่าย {formatSatang(Number(l.owed))}</span>
                <span className="mono" style={{ color: Number(l.difference) < 0 ? "var(--danger)" : "var(--steel)" }}>
                  ส่วนต่าง {formatSatang(Number(l.difference))} · {formatRelativeTime(l.created_at)}
                </span>
              </div>
            ))}
            {(logs ?? []).length === 0 && <p className="text-[13.5px]" style={{ color: "var(--steel)" }}>ยังไม่เคยบันทึก</p>}
          </div>

          <div className="mt-8 mb-1"><h2 className="text-[1.1rem]">จับคู่เงินเข้ากับ statement ({unmatched?.length ?? 0})</h2></div>
          <p className="mb-3 text-[12.5px]" style={{ color: "var(--steel)" }}>
            หาแต่ละยอดใน statement บัญชี B แล้วใส่เลขอ้างอิงของรายการนั้น เงินของคำสั่งซื้อที่เสร็จสิ้นแล้วจะถอนได้หลังจับคู่เท่านั้น
          </p>
          <div className="flex flex-col gap-3">
            {(unmatched ?? []).map((o) => (
              <div key={o.id} className="flex flex-col gap-3 rounded-2xl p-4" style={card}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="mono text-[14px]">#{o.order_code} · {(o.seller as unknown as { display_name: string } | null)?.display_name ?? "—"}</span>
                  <span className="mono text-[16px]">฿{o.amount.toLocaleString("en-US")} <span className="text-[12px]" style={{ color: "var(--steel)" }}>{o.status}</span></span>
                </div>
                <MatchForm orderId={o.id} />
              </div>
            ))}
            {(unmatched ?? []).length === 0 && <p className="text-[13.5px]" style={{ color: "var(--steel)" }}>ไม่มีรายการรอจับคู่</p>}
          </div>

          <div className="mt-8 mb-3"><h2 className="text-[1.1rem]">ส่งออกให้นักบัญชี</h2></div>
          <form action="/admin/reconciliation/csv" className="flex flex-wrap items-center gap-2">
            <input type="month" name="month" defaultValue={month} required aria-label="เดือน" className="rounded-lg px-3 text-[13px]" style={{ height: 36, background: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--white)" }} />
            <button type="submit" className="rounded-lg border-0 px-3 text-[13px] font-semibold cursor-pointer" style={{ height: 36, background: "var(--blue)", color: "var(--ink-on-blue)" }}>ดาวน์โหลด CSV</button>
          </form>
        </div>
      </main>
      <Footer note="เครื่องมือแอดมิน — ยอดบัญชี B กรอกจากแอปธนาคารด้วยมือ" />
    </div>
  );
}
