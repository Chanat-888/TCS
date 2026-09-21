"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { formatTHB } from "@/lib/format";
import { type CartItem, EMPTY_CART, clearCart, getCart, removeFromCart, subscribeCart } from "@/lib/cart";

function groupBySeller(items: CartItem[]) {
  const groups = new Map<string, CartItem[]>();
  for (const item of items) {
    const list = groups.get(item.sellerId) ?? [];
    list.push(item);
    groups.set(item.sellerId, list);
  }
  return [...groups.values()];
}

const TRASH_ICON = (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path
      d="M4 6h12M8 6V4.5A1.5 1.5 0 019.5 3h1A1.5 1.5 0 0112 4.5V6m-6.5 0 .6 10.2A1.6 1.6 0 007.7 17.7h4.6a1.6 1.6 0 001.6-1.5L14.5 6"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function CartView() {
  const items = useSyncExternalStore(subscribeCart, getCart, () => EMPTY_CART);
  const groups = groupBySeller(items);
  const total = items.reduce((sum, i) => sum + i.price, 0);

  if (items.length === 0) {
    return (
      <div className="wrap py-8">
        <h1 className="text-[clamp(1.4rem,3vw,1.75rem)]">ตะกร้าของฉัน</h1>
        <div
          className="mt-8 flex flex-col items-center rounded-2xl px-5 py-16 text-center"
          style={{ background: "var(--panel)", border: "1px dashed rgba(140,147,163,0.22)" }}
        >
          <div
            className="mb-[18px] flex items-center justify-center rounded-full"
            style={{ width: 64, height: 64, background: "var(--panel-2)", border: "1px solid rgba(140,147,163,0.2)", color: "var(--steel-dim)" }}
          >
            <svg width="26" height="26" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 5h2l1.6 9.4a1.6 1.6 0 001.58 1.35h6.1a1.6 1.6 0 001.57-1.3L17 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="8.2" cy="17.3" r="1.25" fill="currentColor" />
              <circle cx="14.6" cy="17.3" r="1.25" fill="currentColor" />
            </svg>
          </div>
          <h2 className="text-[1.2rem]">ตะกร้าว่างเปล่า</h2>
          <p className="mx-auto mt-2 max-w-[34ch] text-[13.5px] leading-relaxed" style={{ color: "var(--steel)" }}>
            ยังไม่มีการ์ดหรือเด็คในตะกร้า เลือกดูของที่เปิดขายอยู่แล้วกด &ldquo;เพิ่มลงตะกร้า&rdquo;
          </p>
          <Link
            href="/browse"
            className="mt-5 inline-flex items-center gap-2 rounded-[11px] px-[22px] py-3 text-[14px] font-semibold no-underline"
            style={{ background: "var(--blue)", color: "#071523" }}
          >
            เลือกดูสินค้า
          </Link>
          <Link href="/orders" className="mt-4 text-[12.5px] no-underline" style={{ color: "var(--steel)" }}>
            ดูคำสั่งซื้อของฉัน
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap py-8" style={{ paddingBottom: 108 }}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[clamp(1.4rem,3vw,1.75rem)]">ตะกร้าของฉัน</h1>
          <p className="mt-[6px] text-[13.5px]" style={{ color: "var(--steel)" }}>
            {items.length} ชิ้น จาก {groups.length} ร้านค้า
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/orders" className="text-[13px] no-underline" style={{ color: "var(--steel)" }}>
            คำสั่งซื้อของฉัน
          </Link>
          <button
            type="button"
            onClick={() => window.confirm("ล้างสินค้าทั้งหมดในตะกร้า?") && clearCart()}
            className="flex items-center gap-[6px] py-[10px] text-[13px]"
            style={{ color: "var(--steel)" }}
          >
            {TRASH_ICON} ล้างตะกร้า
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-[26px] min-[901px]:grid-cols-[1fr_360px]">
        <div>
          {groups.map((group) => {
            const seller = group[0];
            const subtotal = group.reduce((sum, i) => sum + i.price, 0);
            return (
              <section
                key={seller.sellerId}
                className="mb-[22px] overflow-hidden rounded-2xl"
                style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.12)" }}
              >
                <div
                  className="flex items-center gap-[10px] px-4 py-[14px]"
                  style={{ background: "var(--panel-2)", borderBottom: "1px solid rgba(140,147,163,0.12)" }}
                >
                  <span
                    className="mono flex flex-shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                    style={{ width: 30, height: 30, background: "rgba(95,212,255,0.1)", border: "1.5px solid rgba(95,212,255,0.35)", color: "var(--cyan)" }}
                  >
                    {seller.sellerName.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="flex min-w-0 items-center gap-[5px] text-[13.5px] font-medium">
                    {seller.sellerName}
                    {seller.sellerVerified && (
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: "var(--cyan)", flexShrink: 0 }}>
                        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
                        <path d="M6.5 10.2 9 12.6 13.5 7.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="ml-auto flex-shrink-0 text-right">
                    <span className="block text-[11px]" style={{ color: "var(--steel-dim)" }}>รวมร้านนี้</span>
                    <span className="mono block text-[13.5px]">{formatTHB(subtotal)}</span>
                  </span>
                </div>

                {group.map((item) => (
                  <div
                    key={item.listingId}
                    className="grid items-center gap-[14px] px-4 py-[14px] max-[520px]:gap-x-3"
                    style={{
                      gridTemplateColumns: "64px 1fr auto auto",
                      borderBottom: "1px solid rgba(140,147,163,0.08)",
                    }}
                  >
                    <div
                      className="relative flex items-center justify-center overflow-hidden rounded-[9px]"
                      style={{ width: 64, height: 80, background: "var(--panel-2)" }}
                    >
                      <span
                        className="mono absolute right-1 top-1 rounded-[5px] px-[5px] py-[1px] text-[9px]"
                        style={{ background: "rgba(47,143,232,0.16)", color: "var(--blue-dim)" }}
                      >
                        {item.rarity}
                      </span>
                      {item.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.photoUrl} alt={item.name} className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <svg width="34%" height="34%" viewBox="0 0 32 32" aria-hidden="true">
                          <path d="M16 2 L19 10 L27 8 L22 15 L28 20 L20 21 L21 29 L16 23 L11 29 L12 21 L4 20 L10 15 L5 8 L13 10 Z" fill="var(--blue)" opacity={0.85} />
                        </svg>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p
                        className="text-[13.5px] font-medium leading-snug"
                        style={{ color: "var(--white)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                      >
                        {item.name}
                      </p>
                      <p className="mt-1 text-[11.5px]" style={{ color: "var(--steel-dim)" }}>
                        {item.setName}
                      </p>
                      <span
                        className="mt-[6px] inline-flex rounded-full px-[7px] py-[2px] text-[10px]"
                        style={{ color: "var(--steel)", background: "rgba(140,147,163,0.1)", border: "1px solid rgba(140,147,163,0.22)" }}
                      >
                        ซื้อทันที
                      </span>
                    </div>

                    <p className="mono whitespace-nowrap text-[14.5px]">{formatTHB(item.price)}</p>

                    <button
                      type="button"
                      aria-label="ลบออกจากตะกร้า"
                      onClick={() => removeFromCart(item.listingId)}
                      className="flex flex-shrink-0 items-center justify-center rounded-[10px] transition-colors"
                      style={{ width: 40, height: 40, background: "transparent", border: "1px solid rgba(140,147,163,0.2)", color: "var(--steel)" }}
                    >
                      {TRASH_ICON}
                    </button>
                  </div>
                ))}
              </section>
            );
          })}
        </div>

        <aside className="static min-[901px]:sticky" style={{ top: 96 }}>
          <div className="rounded-2xl p-5" style={{ background: "var(--panel)", border: "1px solid rgba(140,147,163,0.14)" }}>
            <h2 className="mb-4 text-[15px]">สรุปคำสั่งซื้อ</h2>
            <div className="flex items-baseline justify-between border-t pt-[14px] text-[15.5px]" style={{ borderColor: "rgba(140,147,163,0.16)" }}>
              <span>ยอดชำระทั้งหมด</span>
              <span className="mono text-[20px]">{formatTHB(total)}</span>
            </div>

            <div
              className="mt-3 flex gap-[9px] rounded-[11px] px-[13px] py-[11px] text-[12px] leading-relaxed"
              style={{ background: "rgba(95,212,255,0.06)", border: "1px solid rgba(95,212,255,0.18)", color: "var(--steel)" }}
            >
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: "var(--cyan)", flexShrink: 0, marginTop: 1 }}>
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
                <path d="M10 6.5v4M10 13.2v.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span>
                ระบบจะแยกเป็น <strong style={{ color: "var(--white)" }}>{groups.length} ออเดอร์</strong> ตามร้านค้า แต่ละออเดอร์พักเงินและติดตามสถานะแยกกัน
              </span>
            </div>

            <button
              type="button"
              disabled
              title="ชำระเงินหลายร้านค้าในตะกร้าเดียวกันยังไม่เปิดใช้งาน — ตอนนี้ซื้อทีละชิ้นผ่านหน้าสินค้า"
              className="mt-4 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl text-[14.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: "var(--blue)", color: "#071523" }}
            >
              ดำเนินการชำระเงิน (เร็ว ๆ นี้)
            </button>

            <div className="mt-[18px] flex flex-col gap-[11px] text-[12px] leading-relaxed" style={{ color: "var(--steel)" }}>
              <p>เงินอยู่กับ TCS จนกว่าคุณจะกดรับการ์ดทุกออเดอร์</p>
              <p>ผู้ขายต้องถ่ายวิดีโอแกะกล่องก่อนส่งทุกออเดอร์</p>
              <p>ไม่พอใจการ์ดที่ได้รับ ขอเงินคืนได้ภายใน 48 ชม.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
