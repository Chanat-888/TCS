import { BackHeader } from "@/components/BackHeader";
import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUserId } from "@/lib/session";
import { isAdmin, getAdminOverview } from "@/lib/admin";
import { DISPUTE_REASON_LABELS } from "@/lib/disputeReasons";
import { Footer } from "@/components/Footer";
import { formatTHB, formatRelativeTime } from "@/lib/format";

export default async function AdminOverviewPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  if (!(await isAdmin(userId))) notFound();

  const overview = await getAdminOverview();

  const tiles = [
    { label: "ข้อพิพาทที่รอดำเนินการ", value: overview.openDisputesCount, tone: overview.openDisputesCount > 0 ? "var(--danger)" : "var(--white)" },
    { label: "คำสั่งซื้อที่ยังไม่เสร็จสิ้น", value: overview.openOrdersCount, tone: "var(--white)" },
    { label: "ประกาศขายที่เปิดอยู่", value: overview.activeListingsCount, tone: "var(--white)" },
    { label: "ผู้ใช้ทั้งหมด", value: overview.totalUsers, tone: "var(--white)" },
  ];

  return (
    <div style={{ "--wrap-max": "980px" } as CSSProperties}>
      <BackHeader href="/browse" title="แดชบอร์ดแอดมิน" right={
          <span
            className="mono flex-shrink-0 rounded-full px-[10px] py-1 text-[10.5px]"
            style={{ color: "var(--gold)", background: "var(--gold-tint)", border: "1px solid var(--gold-line)" }}
          >
            ADMIN
          </span>
        } />

      <main className="py-7 pb-[70px]">
        <div className="wrap">
          <div className="grid grid-cols-4 gap-px overflow-hidden rounded-2xl max-[720px]:grid-cols-2" style={{ background: "rgba(140,147,163,0.12)", border: "1px solid rgba(140,147,163,0.12)" }}>
            {tiles.map((t) => (
              <div key={t.label} className="px-5 py-[18px]" style={{ background: "var(--panel)" }}>
                <div className="mono text-[22px]" style={{ color: t.tone }}>{t.value}</div>
                <div className="mt-1 text-[12px]" style={{ color: "var(--steel)" }}>{t.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-7">
            <h2 className="mb-[14px] text-[1.1rem]">ข้อพิพาท</h2>
            {overview.disputes.length === 0 ? (
              <p className="text-[13.5px]" style={{ color: "var(--steel)" }}>ยังไม่มีข้อพิพาทในระบบ</p>
            ) : (
              <div className="flex flex-col gap-[10px]">
                {overview.disputes.map((d) => {
                  const open = d.decision === null;
                  return (
                    <Link
                      key={d.id}
                      href={`/admin/disputes/${d.id}`}
                      className="flex flex-wrap items-center gap-[14px] rounded-2xl p-4 no-underline"
                      style={{ background: "var(--panel)", border: `1px solid ${open ? "rgba(232,102,79,0.3)" : "rgba(140,147,163,0.14)"}` }}
                    >
                      <span
                        className="flex-shrink-0 rounded-full px-[10px] py-1 text-[11.5px]"
                        style={open
                          ? { color: "var(--danger)", background: "rgba(232,102,79,0.1)", border: "1px solid rgba(232,102,79,0.28)" }
                          : { color: "var(--good)", background: "rgba(79,201,122,0.1)", border: "1px solid rgba(79,201,122,0.3)" }}
                      >
                        {open ? "รอดำเนินการ" : d.decision === "refund" ? "คืนเงินแล้ว" : "โอนเงินให้ผู้ขายแล้ว"}
                      </span>
                      <div className="min-w-[160px] flex-1">
                        <p className="text-[13.5px] font-medium" style={{ color: "var(--white)" }}>
                          {DISPUTE_REASON_LABELS[d.reason]} · <span className="mono">#{d.orderCode}</span>
                        </p>
                        <p className="mt-1 text-[12px]" style={{ color: "var(--steel)" }}>
                          {d.buyerMask} vs {d.sellerName} · {formatTHB(d.amount)}
                        </p>
                      </div>
                      <span className="mono flex-shrink-0 text-[11.5px]" style={{ color: "var(--steel-dim)" }}>
                        {formatRelativeTime(open ? d.createdAt : d.decidedAt ?? d.createdAt)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer note="เอกสารแนวคิดฉบับพรีวิว — เครื่องมือแอดมินเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
