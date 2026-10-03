"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/** Click/tap/Escape/outside-click disclosure, so menus work without a mouse. */
export function useDisclosure() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, setOpen, ref };
}

export const panelClass = (open: boolean) =>
  `absolute top-full z-10 pt-3 transition-all duration-150 ${open ? "visible opacity-100" : "invisible opacity-0"}`;

export const itemClass =
  "flex min-h-11 items-center gap-3 rounded-xl px-3 no-underline transition-colors hover:bg-[var(--line-soft)]";

// 40px on narrow phones, 44px from 480px up: six circles plus the logo must fit a 360px screen.
export const circleButtonClass = "h-10 w-10 min-[480px]:h-11 min-[480px]:w-11";
export const circleButtonStyle = { background: "var(--panel)", border: "1px solid var(--line)", color: "var(--steel)" };

export function AccountMenu({ userId }: { userId: string }) {
  const { open, setOpen, ref } = useDisclosure();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="บัญชีของฉัน"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className={`${circleButtonClass} flex cursor-pointer items-center justify-center rounded-full`}
        style={circleButtonStyle}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="6.8" r="3.3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3.5 17c0.9-3.6 4-5.3 6.5-5.3s5.6 1.7 6.5 5.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <div className={`${panelClass(open)} right-0`}>
        <div
          className="flex w-[220px] flex-col gap-1 rounded-2xl p-2"
          style={{ background: "var(--panel)", border: "1px solid var(--line)", boxShadow: "0 24px 48px -16px rgba(0,0,0,0.5)" }}
        >
          <Link href={`/profile/${userId}`} className={itemClass} style={{ color: "var(--white)" }} onClick={() => setOpen(false)}>
            <span className="text-[13.5px] font-medium">บัญชีของฉัน</span>
          </Link>
          <Link href="/orders" className={itemClass} style={{ color: "var(--white)" }} onClick={() => setOpen(false)}>
            <span className="text-[13.5px] font-medium">คำสั่งซื้อของฉัน</span>
          </Link>
          <form action="/logout" method="post" style={{ borderTop: "1px solid var(--line-soft)" }} className="mt-1 pt-1">
            <button type="submit" className={`${itemClass} w-full cursor-pointer text-left text-[13.5px]`} style={{ color: "var(--steel)" }}>
              ออกจากระบบ
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const SECTIONS = [
  { href: "/browse?type=auction", label: "Auction" },
  { href: "/browse?type=product", label: "Product" },
  { href: "/browse?type=wanted", label: "ประกาศหา" },
];

/** Replaces the desktop nav on narrow screens. */
export function MobileMenu() {
  const { open, setOpen, ref } = useDisclosure();
  return (
    <div ref={ref} className="relative min-[641px]:hidden">
      <button
        type="button"
        aria-label="เมนู"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${circleButtonClass} flex cursor-pointer items-center justify-center rounded-full`}
        style={circleButtonStyle}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <div className={`${panelClass(open)} right-0`}>
        <div
          className="flex w-[220px] flex-col gap-1 rounded-2xl p-2"
          style={{ background: "var(--panel)", border: "1px solid var(--line)", boxShadow: "0 24px 48px -16px rgba(0,0,0,0.5)" }}
        >
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} className={itemClass} style={{ color: "var(--white)" }} onClick={() => setOpen(false)}>
              <span className="text-[13.5px] font-medium">{s.label}</span>
            </Link>
          ))}
          {/* The search icon leaves the header on very narrow phones to make room. */}
          <Link href="/search" className={`${itemClass} min-[480px]:hidden`} style={{ color: "var(--white)" }} onClick={() => setOpen(false)}>
            <span className="text-[13.5px] font-medium">ค้นหาการ์ด</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

const PlusIcon = (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/**
 * Quick "post something" buttons. Wide screens get two buttons side by side (sell, and
 * "looking for"); anything narrower gets one + button that opens both, so the phone header fits.
 */
export function CreateMenu() {
  const { open, setOpen, ref } = useDisclosure();
  return (
    <>
      <div className="hidden items-center gap-[10px] min-[1100px]:flex">
        <Link
          href="/listings/new"
          className="flex h-11 items-center gap-[6px] rounded-full px-[18px] no-underline"
          style={{ background: "var(--blue)", color: "#071523" }}
        >
          {PlusIcon}
          <span className="text-[14px] font-semibold">ลงขาย</span>
        </Link>
        <Link
          href="/wanted/new"
          className="flex h-11 items-center rounded-full px-[16px] no-underline transition-colors hover:border-[var(--cyan-line)] hover:text-[var(--cyan)]"
          style={{ background: "var(--panel)", border: "1px solid var(--line-strong)", color: "var(--white)" }}
        >
          <span className="text-[14px] font-medium">ลงประกาศหา</span>
        </Link>
      </div>
      <div ref={ref} className="relative min-[1100px]:hidden">
        <button
          type="button"
          aria-label="ลงประกาศ"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((o) => !o)}
          className={`${circleButtonClass} flex cursor-pointer items-center justify-center rounded-full`}
          style={{ background: "var(--blue)", color: "#071523" }}
        >
          {PlusIcon}
        </button>
        <div className={`${panelClass(open)} left-0 min-[641px]:left-auto min-[641px]:right-0`}>
          <div
            className="flex w-[220px] flex-col gap-1 rounded-2xl p-2"
            style={{ background: "var(--panel)", border: "1px solid var(--line)", boxShadow: "0 24px 48px -16px rgba(0,0,0,0.5)" }}
          >
            <Link href="/listings/new" className={itemClass} style={{ color: "var(--white)" }} onClick={() => setOpen(false)}>
              <span className="text-[13.5px] font-medium">ลงขายการ์ด</span>
            </Link>
            <Link href="/wanted/new" className={itemClass} style={{ color: "var(--white)" }} onClick={() => setOpen(false)}>
              <span className="text-[13.5px] font-medium">ลงประกาศหาการ์ด</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
