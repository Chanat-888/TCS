import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { getOrdersForBuyer, type OrderListItem } from "@/lib/orders";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { StatusPill } from "@/components/StatusPill";
import { formatTHB, formatRelativeTime } from "@/lib/format";
import type { OrderStatus } from "@/lib/supabase/types";

const STATUS: Record<OrderStatus, { label: string; tone: "wait" | "done" | "danger" }> = {
  PENDING_PAYMENT: { label: "รอชำระเงิน", tone: "wait" },
  PAID_HELD: { label: "เงินถูกพักไว้", tone: "wait" },
  SHIPPED: { label: "จัดส่งแล้ว", tone: "wait" },
  DELIVERED: { label: "รอคุณอนุมัติ", tone: "wait" },
  COMPLETED: { label: "เสร็จสมบูรณ์", tone: "done" },
  DISPUTED: { label: "อยู่ระหว่างข้อพิพาท", tone: "danger" },
  CANCELLED: { label: "ยกเลิกแล้ว", tone: "danger" },
  REFUNDED: { label: "คืนเงินแล้ว", tone: "danger" },
};

function OrderRow({ order }: { order: OrderListItem }) {
  const status = STATUS[order.status];
  const href = order.status === "PENDING_PAYMENT" ? `/checkout/${order.id}` : `/orders/${order.id}`;

  return (
    <Link
      href={href}
      className="flex items-center gap-[14px] rounded-2xl p-4 no-underline text-inherit transition-colors hover:bg-[rgba(140,147,163,0.06)]"
      style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}
    >
      <div
        className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-[9px]"
        style={{ width: 52, height: 68, background: "var(--panel-2)" }}
      >
        {order.listingPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={order.listingPhotoUrl} alt={order.listingName} className="h-full w-full object-cover" />
        ) : (
          <svg width="46%" height="46%" viewBox="0 0 64 64" aria-hidden="true">
            <path d="M32 4 L40 28 L64 28 L44 42 L52 64 L32 50 L12 64 L20 42 L0 28 L24 28 Z" fill="var(--cyan)" />
          </svg>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium" style={{ color: "var(--white)" }}>
          {order.listingName}
        </p>
        <p className="mono mt-1 text-[12px]" style={{ color: "var(--steel)" }}>
          #{order.orderCode} · จาก {order.sellerName} · {formatRelativeTime(order.createdAt)}
        </p>
      </div>

      <div className="flex flex-shrink-0 flex-col items-end gap-[7px]">
        <span className="mono text-[14px]" style={{ color: "var(--white)" }}>
          {formatTHB(order.amount)}
        </span>
        <StatusPill tone={status.tone} label={status.label} />
      </div>
    </Link>
  );
}

export default async function OrdersPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const orders = await getOrdersForBuyer(userId);

  return (
    <div style={{ "--wrap-max": "820px", "--wrap-pad": "24px", "--wrap-pad-sm": "16px" } as CSSProperties}>
      <SiteHeader userId={userId} />
      <main className="wrap py-8">
        <h1 className="text-[clamp(1.4rem,3vw,1.75rem)]">คำสั่งซื้อของฉัน</h1>

        {orders.length === 0 ? (
          <div
            className="mt-8 flex flex-col items-center rounded-2xl px-5 py-16 text-center"
            style={{ background: "var(--panel)", border: "1px dashed rgba(140,147,163,0.22)" }}
          >
            <h2 className="text-[1.15rem]">ยังไม่มีคำสั่งซื้อ</h2>
            <p className="mt-2 text-[13.5px]" style={{ color: "var(--steel)" }}>
              เมื่อคุณซื้อหรือชนะประมูลการ์ด คำสั่งซื้อจะแสดงที่นี่
            </p>
            <Link
              href="/browse"
              className="mt-5 inline-flex items-center gap-2 rounded-[11px] px-[22px] py-3 text-[14px] font-semibold no-underline"
              style={{ background: "var(--blue)", color: "#071523" }}
            >
              เลือกดูสินค้า
            </Link>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
      </main>
      <Footer note="เอกสารแนวคิดฉบับพรีวิว — สถานะคำสั่งซื้อเชื่อมกับฐานข้อมูลจริง" />
    </div>
  );
}
